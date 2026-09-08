"use server"

import { revalidatePath } from "next/cache"

import { deleteScreenshot } from "~/lib/blob"
import { requireUser } from "~/lib/current-user"
import * as bookmarks from "~/lib/db/bookmarks"
import * as folders from "~/lib/db/folders"
import { discoverFaviconUrl, discoverShareImageUrl } from "~/lib/favicon"
import { hostnameOf, normalizeUrl, parseTags } from "~/lib/format"
import { BACKFILL_BATCH, IMPORT_CHUNK, type ImportedBookmark } from "~/lib/netscape"

export type ActionResult = { ok: true } | { ok: false; error: string }

/*
 * Every action starts by resolving who is calling and passes that id down. A
 * server action is a public endpoint, not an internal function: anyone can post
 * to it with any id they like, so the owner is taken from the session cookie
 * rather than from anything the caller sent.
 */

function refresh() {
  revalidatePath("/app")
}

function folderIdFrom(formData: FormData): string | null {
  const raw = String(formData.get("folder_id") ?? "")
  return raw === "" || raw === "none" ? null : raw
}

/* -------------------------------------------------------------------------- */
/* Bookmarks                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Saves a bookmark typed straight into the site, for when the extension is not
 * installed or the page is one the browser will not let it capture.
 *
 * Re-saving an address you already have merges into that row rather than
 * making a second copy, the same rule the extension follows.
 */
export async function createBookmark(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser()

    const url = normalizeUrl(String(formData.get("url") ?? ""))
    if (!url) return { ok: false, error: "That does not look like a web address." }

    const typedTitle = String(formData.get("title") ?? "").trim().slice(0, 500)

    // Best effort, and bounded, a slow or unreachable site should not stop the
    // bookmark from saving. Nothing reads a screenshot for a typed address
    // though, that would need rendering the page, so those frames fall back to
    // a lettered mark, which is by design.
    const faviconUrl = await discoverFaviconUrl(url).catch(() => null)

    await bookmarks.upsertByUrl(user.id, {
      url,
      title: typedTitle || hostnameOf(url),
      faviconUrl,
      screenshotUrl: null,
      tags: parseTags(String(formData.get("tags") ?? "")),
      notes: String(formData.get("notes") ?? "").slice(0, 10000).trim(),
      folderId: folderIdFrom(formData)
    })

    refresh()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." }
  }
}

export async function updateBookmark(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser()

    const id = String(formData.get("id") ?? "")
    if (!id) return { ok: false, error: "Missing bookmark id." }

    const updated = await bookmarks.editBookmark(user.id, id, {
      title: String(formData.get("title") ?? "").trim().slice(0, 500),
      notes: String(formData.get("notes") ?? "").slice(0, 10000),
      tags: parseTags(String(formData.get("tags") ?? "")),
      folderId: folderIdFrom(formData)
    })

    if (!updated) return { ok: false, error: "That bookmark no longer exists." }

    refresh()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." }
  }
}

export async function setStarred(id: string, starred: boolean): Promise<ActionResult> {
  try {
    const user = await requireUser()

    if (!(await bookmarks.setStarred(user.id, id, starred))) {
      return { ok: false, error: "That bookmark no longer exists." }
    }

    refresh()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." }
  }
}

export async function deleteBookmark(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser()
    await deleteScreenshot(await bookmarks.deleteBookmark(user.id, id))

    refresh()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." }
  }
}

/* -------------------------------------------------------------------------- */
/* Marking up several frames at once                                           */
/* -------------------------------------------------------------------------- */

export type BulkAction =
  | { kind: "star"; starred: boolean }
  | { kind: "file"; folderId: string | null }
  | { kind: "delete" }

/**
 * Star, file or delete a selection in one go.
 *
 * The ids come from the browser, so they are only a request. Every statement
 * underneath carries `and user_id = ?`, which means sending somebody else's id
 * simply matches nothing rather than touching their row, and the count that
 * comes back is of rows that were actually yours.
 */
export async function bulkUpdate(ids: string[], action: BulkAction): Promise<ActionResult> {
  try {
    const user = await requireUser()
    if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Nothing selected." }

    if (action.kind === "delete") {
      const orphaned = await bookmarks.bulkDelete(user.id, ids)
      // Sequential rather than parallel: a burst of deletes against blob
      // storage is not worth the risk of being rate limited mid way through.
      for (const url of orphaned) await deleteScreenshot(url)
    } else if (action.kind === "star") {
      await bookmarks.bulkSetStarred(user.id, ids, action.starred)
    } else {
      await bookmarks.bulkSetFolder(user.id, ids, action.folderId)
    }

    refresh()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." }
  }
}

/* -------------------------------------------------------------------------- */
/* Folders                                                                     */
/* -------------------------------------------------------------------------- */

export async function createFolder(formData: FormData): Promise<ActionResult> {
  const user = await requireUser()

  const name = String(formData.get("name") ?? "").trim().slice(0, 60)
  if (!name) return { ok: false, error: "Give the folder a name." }

  const result = await folders.createFolder(user.id, name)
  if (!result.ok) return result

  refresh()
  return { ok: true }
}

export async function renameFolder(id: string, name: string): Promise<ActionResult> {
  const user = await requireUser()

  const clean = name.trim().slice(0, 60)
  if (!clean) return { ok: false, error: "Give the folder a name." }

  const result = await folders.renameFolder(user.id, id, clean)
  if (!result.ok) return result

  refresh()
  return { ok: true }
}

/** Deletes the folder. Bookmarks inside it survive and become unfiled. */
export async function deleteFolder(id: string): Promise<ActionResult> {
  const user = await requireUser()

  if (!(await folders.deleteFolder(user.id, id))) {
    return { ok: false, error: "That folder no longer exists." }
  }

  refresh()
  return { ok: true }
}

export type ImportResult =
  | { ok: true; added: number; alreadyHad: number }
  | { ok: false; error: string }

/**
 * Takes one chunk of a browser export.
 *
 * The file is parsed in the browser and posted in pieces rather than uploaded
 * whole, for two reasons. A big export would otherwise be one enormous request
 * that a serverless function has to finish inside its time limit, and posting
 * in pieces is what lets the dialog show progress rather than sitting on a
 * spinner for a minute with nothing to say.
 *
 * The chunk is re-validated here rather than trusted. This is a public
 * endpoint: the browser did the parsing, but nothing stops a caller posting
 * whatever it likes straight to it.
 */
export async function importChunk(items: ImportedBookmark[]): Promise<ImportResult> {
  const user = await requireUser()

  if (!Array.isArray(items)) return { ok: false, error: "That is not a list of bookmarks." }
  if (items.length > IMPORT_CHUNK) {
    return { ok: false, error: `Send at most ${IMPORT_CHUNK} at a time.` }
  }

  /*
   * Folders arrive as names, because the file has names and the browser has no
   * idea what a Bento folder id is. Resolving them here keeps the client from
   * having to create folders itself, and one read plus one create per new name
   * is cheap when a whole export rarely has more than a few dozen.
   */
  const wanted = new Set(items.map((i) => i.folder?.trim()).filter((n): n is string => Boolean(n)))
  const byName = new Map<string, string>()

  for (const folder of await folders.listFolders(user.id)) {
    byName.set(folder.name.toLowerCase(), folder.id)
  }

  for (const name of wanted) {
    if (byName.has(name.toLowerCase())) continue

    const made = await folders.createFolder(user.id, name)
    if (made.ok) byName.set(made.folder.name.toLowerCase(), made.folder.id)
  }

  const prepared: bookmarks.ImportInput[] = []

  for (const item of items) {
    // The same guard the manual add form uses. The client already applied it,
    // which is not a reason to skip it on the server.
    const url = normalizeUrl(String(item.url ?? ""))
    if (!url) continue

    const icon = String(item.faviconUrl ?? "")
    prepared.push({
      url,
      title: String(item.title ?? "").slice(0, 500),
      // Only a data image survives, for the same reason the parser says: this
      // ends up in an img src and it came out of a file.
      faviconUrl: icon.startsWith("data:image/") && icon.length <= 8192 ? icon : null,
      folderId: item.folder ? (byName.get(item.folder.trim().toLowerCase()) ?? null) : null,
      addedAt: typeof item.addedAt === "string" && !Number.isNaN(Date.parse(item.addedAt)) ? item.addedAt : null
    })
  }

  try {
    const outcome = await bookmarks.importBookmarks(user.id, prepared)
    revalidatePath("/app")
    return { ok: true, ...outcome }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save those." }
  }
}

export type BackfillResult =
  | { ok: true; looked: number; found: number; nextCursor: bookmarks.ImageCursor | null }
  | { ok: false; error: string }

/**
 * Finds share images for bookmarks that have no picture.
 *
 * One batch per call, driven from the client, for the same reason the import
 * is chunked: each of these is an outbound request to somebody else's server,
 * and a couple of hundred in one invocation would sit well past any sensible
 * function timeout.
 *
 * The lookups run together rather than one after another. They are almost
 * entirely waiting on the network, and a batch of ten sequential four second
 * timeouts would be forty seconds of nothing.
 */
export async function backfillShareImages(
  after: bookmarks.ImageCursor | null = null
): Promise<BackfillResult> {
  const user = await requireUser()

  try {
    const batch = await bookmarks.bookmarksWithoutImage(user.id, BACKFILL_BATCH, after)
    if (batch.length === 0) return { ok: true, looked: 0, found: 0, nextCursor: null }

    const results = await Promise.all(
      batch.map(async (bookmark) => {
        const imageUrl = await discoverShareImageUrl(bookmark.url).catch(() => null)
        return imageUrl ? { id: bookmark.id, imageUrl } : null
      })
    )

    const found = results.filter((r): r is { id: string; imageUrl: string } => r !== null)
    await bookmarks.setShareImages(user.id, found)

    /*
     * The cursor is the last row looked at, not the last one filled. Plenty of
     * pages have no share image, and without this those rows would come back
     * on every call and the loop would never end. Found that by running it:
     * four bookmarks with no image turned into three hundred and forty four
     * lookups before it was stopped by hand.
     */
    const last = batch[batch.length - 1]

    revalidatePath("/app")
    return {
      ok: true,
      looked: batch.length,
      found: found.length,
      nextCursor: { createdAt: last.created_at, id: last.id }
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not look those up." }
  }
}
