"use server"

import { revalidatePath } from "next/cache"

import { deleteScreenshot } from "~/lib/blob"
import { requireUser } from "~/lib/current-user"
import * as bookmarks from "~/lib/db/bookmarks"
import * as folders from "~/lib/db/folders"
import { discoverFaviconUrl } from "~/lib/favicon"
import { hostnameOf, normalizeUrl, parseTags } from "~/lib/format"

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
