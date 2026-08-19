/** Small display helpers shared across the tray. */

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export function prettyPath(url: string): string {
  try {
    const u = new URL(url)
    const path = `${u.pathname}${u.search}`.replace(/\/$/, "")
    return path === "" ? "/" : path
  } catch {
    return ""
  }
}

const DATE = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "UTC"
})

/** 2026-08-18, deliberately monospace friendly. */
export function isoDate(value: string): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "" : DATE.format(d)
}

export function relativeTime(value: string): string {
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return ""

  const seconds = Math.round((Date.now() - then) / 1000)
  if (seconds < 60) return "just now"

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`

  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo ago`

  return `${Math.round(months / 12)}y ago`
}

/**
 * Cleans up a typed address. Accepts "example.com/page" as well as a full URL,
 * and returns null for anything that is not reachable over http.
 *
 * The fragment is deliberately kept. The extension saves whatever the browser
 * reports as the tab address, fragment and all, and the unique index is on the
 * exact string, so stripping it here would let the same page land twice.
 */
export function normalizeUrl(input: string): string | null {
  const raw = input.trim()
  if (!raw || raw.length > 4000) return null

  const isLoopback = /^(localhost|127\.0\.0\.1)(?::|\/|$)/i.test(raw)

  // "host:8080/path" carries a port, not a scheme. Anything else with a colon
  // before the first slash is claiming a scheme, and only http and https are
  // allowed. Without this check "mailto:a@b.com" would be pasted onto an https
  // prefix and come back out as a URL with credentials in it.
  const hasPort = /^[^:/?#]+:\d+(?:[/?#]|$)/.test(raw)
  const declaresScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) && !hasPort

  let candidate: string
  if (declaresScheme) {
    if (!/^https?:\/\//i.test(raw)) return null
    candidate = raw
  } else {
    // A bare loopback address is being served over http in practice.
    candidate = `${isLoopback ? "http" : "https"}://${raw}`
  }

  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    return null
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null

  // A bare word is a typo, not a host. localhost is the one that really is a
  // host, and the extension can capture it, so typing it in should work too.
  if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") return null

  return parsed.toString()
}

/** Splits "react, ui , notes" into ["react", "ui", "notes"]. */
export function parseTags(input: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  for (const raw of input.split(/[,\n]/)) {
    const tag = raw.trim().replace(/^#/, "").toLowerCase()
    if (!tag || tag.length > 32) continue
    if (seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
    if (out.length >= 12) break
  }

  return out
}
