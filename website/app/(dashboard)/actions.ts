"use server"

import { revalidatePath } from "next/cache"

import { hostnameOf, normalizeUrl, parseTags } from "~/lib/format"
import { createClient } from "~/lib/supabase/server"

export type ActionResult = { ok: true } | { ok: false; error: string }

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) throw new Error("Not signed in.")
  return { supabase, user }
}

function refresh() {
  revalidatePath("/app")
}

/* -------------------------------------------------------------------------- */
/* Bookmarks                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Saves a bookmark typed straight into the site, for when the extension is not
 * installed or the page is one the browser will not let it capture.
 *
 * Re-saving an address you already have merges into that row rather than
 * failing on the unique index, which is the same rule the extension follows.
 */
export async function createBookmark(formData: FormData): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser()

    const url = normalizeUrl(String(formData.get("url") ?? ""))
    if (!url) return { ok: false, error: "That does not look like a web address." }

    const typedTitle = String(formData.get("title") ?? "").trim().slice(0, 500)
    const title = typedTitle || hostnameOf(url)
    const notes = String(formData.get("notes") ?? "").slice(0, 10000).trim()
    const tags = parseTags(String(formData.get("tags") ?? ""))
    const rawFolder = String(formData.get("folder_id") ?? "")
    const folder_id = rawFolder === "" || rawFolder === "none" ? null : rawFolder

    const { data: existing } = await supabase
      .from("bookmarks")
      .select("*")
      .eq("user_id", user.id)
      .eq("url", url)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from("bookmarks")
        .update({
          title: typedTitle || existing.title,
          tags: [...new Set([...existing.tags, ...tags])].slice(0, 12),
          notes: notes || existing.notes,
          folder_id: folder_id ?? existing.folder_id
        })
        .eq("id", existing.id)
        .eq("user_id", user.id)

      if (error) return { ok: false, error: error.message }

      refresh()
      return { ok: true }
    }

    const { error } = await supabase.from("bookmarks").insert({
      user_id: user.id,
      url,
      title,
      // Nothing to read a favicon or screenshot from when the address is typed.
      // The compartment falls back to a lettered mark, which is by design.
      favicon_url: null,
      screenshot_url: null,
      tags,
      notes,
      folder_id,
      starred: false
    })

    if (error) return { ok: false, error: error.message }

    refresh()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." }
  }
}

export async function updateBookmark(formData: FormData): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser()

    const id = String(formData.get("id") ?? "")
    if (!id) return { ok: false, error: "Missing bookmark id." }

    const title = String(formData.get("title") ?? "").trim().slice(0, 500)
    const notes = String(formData.get("notes") ?? "").slice(0, 10000)
    const tags = parseTags(String(formData.get("tags") ?? ""))
    const rawFolder = String(formData.get("folder_id") ?? "")
    const folder_id = rawFolder === "" || rawFolder === "none" ? null : rawFolder

    const { error } = await supabase
      .from("bookmarks")
      .update({ title, notes, tags, folder_id })
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) return { ok: false, error: error.message }

    refresh()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." }
  }
}

export async function setStarred(id: string, starred: boolean): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser()

    const { error } = await supabase
      .from("bookmarks")
      .update({ starred })
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) return { ok: false, error: error.message }

    refresh()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." }
  }
}

export async function deleteBookmark(id: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser()

    // Clear the screenshot too, otherwise the bucket grows forever.
    const { data: row } = await supabase
      .from("bookmarks")
      .select("screenshot_url")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle()

    const { error } = await supabase.from("bookmarks").delete().eq("id", id).eq("user_id", user.id)
    if (error) return { ok: false, error: error.message }

    const objectPath = screenshotObjectPath(row?.screenshot_url ?? null)
    if (objectPath) await supabase.storage.from("screenshots").remove([objectPath])

    refresh()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." }
  }
}

/** Pulls "<uid>/<file>.jpg" back out of a public storage URL. */
function screenshotObjectPath(publicUrl: string | null): string | null {
  if (!publicUrl) return null
  const marker = "/storage/v1/object/public/screenshots/"
  const at = publicUrl.indexOf(marker)
  if (at === -1) return null
  return decodeURIComponent(publicUrl.slice(at + marker.length))
}

/* -------------------------------------------------------------------------- */
/* Folders                                                                     */
/* -------------------------------------------------------------------------- */

export async function createFolder(formData: FormData): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser()

    const name = String(formData.get("name") ?? "").trim().slice(0, 60)
    if (!name) return { ok: false, error: "Give the folder a name." }

    const { error } = await supabase.from("folders").insert({ user_id: user.id, name })

    if (error) {
      const message = error.code === "23505" ? "You already have a folder called that." : error.message
      return { ok: false, error: message }
    }

    refresh()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." }
  }
}

export async function renameFolder(id: string, name: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser()

    const clean = name.trim().slice(0, 60)
    if (!clean) return { ok: false, error: "Give the folder a name." }

    const { error } = await supabase
      .from("folders")
      .update({ name: clean })
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      const message = error.code === "23505" ? "You already have a folder called that." : error.message
      return { ok: false, error: message }
    }

    refresh()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." }
  }
}

/** Deletes the folder. Bookmarks inside it survive and become unfiled. */
export async function deleteFolder(id: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser()

    const { error } = await supabase.from("folders").delete().eq("id", id).eq("user_id", user.id)
    if (error) return { ok: false, error: error.message }

    refresh()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." }
  }
}
