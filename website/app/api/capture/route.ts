import { unauthorized, userFromBearer } from "~/lib/auth"
import { deleteScreenshot, saveScreenshot } from "~/lib/blob"
import { corsJson, corsPreflight } from "~/lib/cors"
import { upsertByUrl } from "~/lib/db/bookmarks"
import { folderExists } from "~/lib/db/folders"
import { normalizeUrl, parseTags } from "~/lib/format"

export const runtime = "nodejs"

export function OPTIONS(request: Request) {
  return corsPreflight(request)
}

/**
 * The extension's one endpoint. Takes the whole capture, tab metadata, tags,
 * note, folder choice and an optional screenshot, in a single multipart
 * request, and merges it the same way saving from the website does.
 */
export async function POST(request: Request) {
  const user = await userFromBearer(request)
  if (!user) return unauthorized(request)

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
  const folderIdValid = Boolean(rawFolderId) && (await folderExists(user.id, rawFolderId))
  const folderId = folderIdValid ? rawFolderId : null

  let screenshotUrl: string | null = null
  const screenshot = form.get("screenshot")

  if (screenshot instanceof File && screenshot.size > 0) {
    const saved = await saveScreenshot(screenshot)

    if (saved.ok) {
      screenshotUrl = saved.url
    } else if (saved.error === "Screenshot is too large.") {
      return corsJson(request, { error: saved.error }, { status: 413 })
    }
    // Any other upload failure is not worth losing the capture over. The
    // bookmark saves without a picture and the frame falls back to its
    // lettered mark, which is a designed state rather than an error.
  }

  const { bookmark, updated, replacedScreenshotUrl } = await upsertByUrl(user.id, {
    url,
    title,
    faviconUrl,
    screenshotUrl,
    tags,
    notes,
    folderId
  })

  // A recapture that brings a new screenshot leaves the old one with nothing
  // pointing at it any more, once the row moves on.
  await deleteScreenshot(replacedScreenshotUrl)

  return corsJson(request, {
    bookmark,
    updated,
    folderWasStale: Boolean(rawFolderId) && !folderIdValid
  })
}
