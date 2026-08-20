import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

import { isBlockedAddress } from "./ssrf-guard.ts"

/**
 * Finds a favicon for a manually added bookmark. The extension gets its
 * favicon straight from Chrome, this is the equivalent for a page typed
 * straight into the site: fetch the page, look for a <link rel="icon">, fall
 * back to /favicon.ico, and store whichever one actually resolves.
 *
 * The icon itself is never downloaded and re-hosted, only its address, the
 * same as what the extension already stores. That keeps this to one small
 * lookup rather than a file to write, serve and eventually garbage collect.
 */

const FETCH_TIMEOUT_MS = 4000
const MAX_HTML_BYTES = 200_000
const MAX_REDIRECTS = 3
const USER_AGENT = "Bento-Favicon/1.0"

async function resolvesToPublicAddress(hostname: string): Promise<boolean> {
  const family = isIP(hostname)
  if (family === 4 || family === 6) return !isBlockedAddress(hostname, family)

  let records: { address: string; family: number }[]
  try {
    records = await lookup(hostname, { all: true, verbatim: true })
  } catch {
    return false
  }

  if (records.length === 0) return false
  return records.every((r) => !isBlockedAddress(r.address, r.family === 6 ? 6 : 4))
}

/**
 * fetch() with redirect: "follow" would happily land on an internal address
 * after the first, approved hop. This checks every hop itself instead, and
 * refuses anything that is not plain http or https.
 */
async function guardedFetch(url: string, method: "GET" | "HEAD", accept: string): Promise<Response | null> {
  let current = url

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let parsed: URL
    try {
      parsed = new URL(current)
    } catch {
      return null
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
    if (!(await resolvesToPublicAddress(parsed.hostname))) return null

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(current, {
        method,
        redirect: "manual",
        signal: controller.signal,
        headers: { accept, "user-agent": USER_AGENT }
      })
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location")
      if (!location) return null

      try {
        current = new URL(location, current).toString()
      } catch {
        return null
      }
      continue
    }

    return response
  }

  return null
}

async function readBounded(response: Response, maxBytes: number): Promise<string | null> {
  const reader = response.body?.getReader()
  if (!reader) return null

  const chunks: Uint8Array[] = []
  let total = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break

    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }

  return Buffer.concat(chunks).toString("utf8")
}

/** A small, bounded scan for <link rel="icon"> style tags, not a full HTML parser. */
function extractIconHref(html: string, base: URL): string | null {
  const linkTag = /<link\b[^>]*>/gi
  let best: { href: string; rank: number } | null = null

  for (const match of html.matchAll(linkTag)) {
    const tag = match[0]
    const relMatch = /\brel\s*=\s*["']([^"']+)["']/i.exec(tag)
    const hrefMatch = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)
    if (!relMatch || !hrefMatch || !hrefMatch[1].trim()) continue

    const rel = relMatch[1].toLowerCase()
    if (!rel.includes("icon")) continue
    const rank = rel.includes("shortcut") || rel === "icon" ? 2 : 1

    if (best && rank <= best.rank) continue

    try {
      best = { href: new URL(hrefMatch[1], base).toString(), rank }
    } catch {
      // Malformed href on the page, skip it.
    }
  }

  return best?.href ?? null
}

/**
 * Some servers reject HEAD outright rather than answering it, nginx set up to
 * serve static files without an explicit HEAD handler is a common one. GET is
 * the fallback, with the body cancelled the moment the headers are in, so the
 * icon bytes themselves are never actually downloaded either way.
 */
async function verifyImage(url: string): Promise<boolean> {
  let response = await guardedFetch(url, "HEAD", "image/*")

  if (!response || !response.ok) {
    response = await guardedFetch(url, "GET", "image/*")
    if (!response || !response.ok) return false
    await response.body?.cancel()
  }

  const contentType = response.headers.get("content-type") ?? ""
  return contentType.startsWith("image/")
}

export async function discoverFaviconUrl(pageUrl: string): Promise<string | null> {
  const page = new URL(pageUrl)

  const candidates: string[] = []

  const htmlResponse = await guardedFetch(page.toString(), "GET", "text/html")
  if (htmlResponse?.ok) {
    const html = await readBounded(htmlResponse, MAX_HTML_BYTES)
    const fromPage = html ? extractIconHref(html, page) : null
    if (fromPage) candidates.push(fromPage)
  }

  candidates.push(new URL("/favicon.ico", page.origin).toString())

  for (const candidate of candidates) {
    if (await verifyImage(candidate)) return candidate
  }

  return null
}
