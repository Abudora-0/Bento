import { writeFileSync } from "node:fs"
import { randomUUID } from "node:crypto"

import { hasValidBearer, unauthorized } from "~/lib/auth"
import { corsJson, corsPreflight } from "~/lib/cors"
import { folderExists } from "~/lib/db/folders"
import { upsertByUrl } from "~/lib/db/bookmarks"
import { screenshotPath } from "~/lib/db/client"
import { normalizeUrl, parseTags } from "~/lib/format"
import { siteUrl } from "~/lib/site-url"

export const runtime = "nodejs"

const MAX_SCREENSHOT_BYTES = 3 * 1024 * 1024

export function OPTIONS(request: Request) {
  return corsPreflight(request)
}

/**
 * The extension's one endpoint. Takes the whole capture, tab metadata, tags,
 * note, folder choice and an optional screenshot, in a single multipart
 * request, and merges it the same way saving from the website does.
 */
export async function POST(request: Request) {
  if (!(await hasValidBearer(request))) return unauthorized(request)

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return corsJson(request, { error: "Expected a multipart form." }, { status: 400 })
  }

  const url = normalizeUrl(String(form.get("url") ?? ""))
  if (!url) return corsJson(request, { error: "That does not look like a web address." }, { status: 400 })

  const title = String(form.get("title") ?? "").trim().slice(0, 500)
  const faviconUrl = String(form.get("faviconUrl") ?? "").trim() || null
  const tags = parseTags(String(form.get("tags") ?? ""))
  const notes = String(form.get("notes") ?? "")

  const rawFolderId = String(form.get("folderId") ?? "")
  // A folder deleted on the website leaves a stale id behind in the
  // extension's storage. The foreign key would reject the whole capture over
  // it, so fall back to unfiled instead of failing a capture on a filing
  // detail, and tell the caller so it can forget the stale id.
  const folderIdValid = Boolean(rawFolderId) && folderExists(rawFolderId)
  const folderId = folderIdValid ? rawFolderId : null

  let screenshotUrl: string | null = null
  const screenshot = form.get("screenshot")

  if (screenshot instanceof File && screenshot.size > 0) {
    if (screenshot.size > MAX_SCREENSHOT_BYTES) {
      return corsJson(request, { error: "Screenshot is too large." }, { status: 413 })
    }

    const filename = `${randomUUID()}.jpg`
    const path = screenshotPath(filename)

    if (path) {
      writeFileSync(path, Buffer.from(await screenshot.arrayBuffer()))
      screenshotUrl = `${siteUrl()}/api/screenshots/${filename}`
    }
  }

  const { bookmark, updated } = upsertByUrl({
    url,
    title,
    faviconUrl,
    screenshotUrl,
    tags,
    notes,
    folderId
  })

  return corsJson(request, {
    bookmark,
    updated,
    folderWasStale: Boolean(rawFolderId) && !folderIdValid
  })
}
