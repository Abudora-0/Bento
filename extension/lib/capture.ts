import { supabase } from "./supabase"
import type { Bookmark, Folder } from "./types"

/** Chrome will not let an extension screenshot its own pages or the store. */
export function isCapturable(url: string | undefined): url is string {
  if (!url) return false
  return /^https?:\/\//i.test(url)
}

export type ActiveTab = {
  id: number
  windowId: number
  url: string
  title: string
  faviconUrl: string | null
}

export async function getActiveTab(): Promise<ActiveTab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  if (!tab || tab.id === undefined || !isCapturable(tab.url)) return null

  return {
    id: tab.id,
    windowId: tab.windowId,
    url: tab.url,
    title: (tab.title ?? "").trim(),
    faviconUrl: tab.favIconUrl ?? null
  }
}

/**
 * Grabs the visible part of the tab and shrinks it to something worth storing.
 * Contact sheet frames are small, a 640px wide JPEG is more than enough.
 */
export async function grabScreenshot(windowId: number): Promise<Blob | null> {
  let dataUrl: string

  try {
    dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "jpeg", quality: 82 })
  } catch {
    // No activeTab grant for this page, a protected page, or a background window.
    return null
  }

  if (!dataUrl) return null

  try {
    const source = await createImageBitmap(await (await fetch(dataUrl)).blob())

    const targetWidth = Math.min(640, source.width)
    const scale = targetWidth / source.width
    const targetHeight = Math.round(source.height * scale)

    const canvas = new OffscreenCanvas(targetWidth, targetHeight)
    const context = canvas.getContext("2d")
    if (!context) return null

    context.drawImage(source, 0, 0, targetWidth, targetHeight)
    source.close()

    return await canvas.convertToBlob({ type: "image/jpeg", quality: 0.72 })
  } catch {
    return null
  }
}

async function uploadScreenshot(userId: string, blob: Blob): Promise<string | null> {
  const path = `${userId}/${crypto.randomUUID()}.jpg`

  const { error } = await supabase.storage.from("screenshots").upload(path, blob, {
    contentType: "image/jpeg",
    cacheControl: "31536000",
    upsert: false
  })

  if (error) return null

  return supabase.storage.from("screenshots").getPublicUrl(path).data.publicUrl
}

export type CaptureInput = {
  url: string
  title: string
  faviconUrl: string | null
  tags: string[]
  notes: string
  screenshot: Blob | null
  /** null files it under Unfiled. */
  folderId: string | null
}

const LAST_FOLDER_KEY = "bento.lastFolderId"

export async function listFolders(): Promise<Folder[]> {
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data } = await supabase
    .from("folders")
    .select("*")
    .eq("user_id", user.id)
    .order("name")

  return data ?? []
}

/**
 * The popup reopens empty every time, so the folder you are currently filing
 * into has to live somewhere. The keyboard shortcut reads the same value, which
 * keeps the two capture paths landing in the same place.
 */
export async function rememberFolder(id: string | null): Promise<void> {
  if (id) await chrome.storage.local.set({ [LAST_FOLDER_KEY]: id })
  else await chrome.storage.local.remove(LAST_FOLDER_KEY)
}

export async function lastFolder(): Promise<string | null> {
  const result = await chrome.storage.local.get(LAST_FOLDER_KEY)
  return (result[LAST_FOLDER_KEY] as string | undefined) ?? null
}

export type CaptureResult =
  | { ok: true; bookmark: Bookmark; updated: boolean }
  | { ok: false; error: string }

/**
 * Saves the tab. Re-capturing a page you already have merges into the existing
 * row rather than making a second copy of it, so tags and notes survive.
 */
export async function saveCapture(input: CaptureInput): Promise<CaptureResult> {
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) return { ok: false, error: "Sign in to save." }

  const url = input.url.trim()
  if (!isCapturable(url)) return { ok: false, error: "This page cannot be saved." }

  // A folder deleted on the website leaves a stale id behind here. The database
  // trigger would reject it outright, so check first and quietly fall back to
  // unfiled rather than failing a capture over a filing detail.
  let folderId = input.folderId
  if (folderId) {
    const { data: folder } = await supabase
      .from("folders")
      .select("id")
      .eq("user_id", user.id)
      .eq("id", folderId)
      .maybeSingle()

    if (!folder) {
      folderId = null
      await rememberFolder(null)
    }
  }

  const { data: existing } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", user.id)
    .eq("url", url)
    .maybeSingle()

  let screenshotUrl: string | null = null
  if (input.screenshot) {
    screenshotUrl = await uploadScreenshot(user.id, input.screenshot)
  }

  if (existing) {
    const mergedTags = [...new Set([...existing.tags, ...input.tags])].slice(0, 12)
    const notes = input.notes.trim() ? input.notes.trim() : existing.notes

    const { data, error } = await supabase
      .from("bookmarks")
      .update({
        title: input.title || existing.title,
        favicon_url: input.faviconUrl ?? existing.favicon_url,
        screenshot_url: screenshotUrl ?? existing.screenshot_url,
        tags: mergedTags,
        notes,
        // Leaving the picker on Unfiled does not drag a filed bookmark back out,
        // matching what the website does when you re-save an address.
        folder_id: folderId ?? existing.folder_id
      })
      .eq("id", existing.id)
      .select("*")
      .single()

    if (error) return { ok: false, error: error.message }
    return { ok: true, bookmark: data, updated: true }
  }

  const { data, error } = await supabase
    .from("bookmarks")
    .insert({
      user_id: user.id,
      url,
      title: input.title.slice(0, 500),
      favicon_url: input.faviconUrl,
      screenshot_url: screenshotUrl,
      tags: input.tags,
      notes: input.notes.trim().slice(0, 10000),
      folder_id: folderId,
      starred: false
    })
    .select("*")
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, bookmark: data, updated: false }
}

export async function recentCaptures(limit = 12): Promise<Bookmark[]> {
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit)

  return data ?? []
}

/** Total frames exposed on this roll, shown in the leader. */
export async function captureCount(): Promise<number> {
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) return 0

  const { count } = await supabase
    .from("bookmarks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)

  return count ?? 0
}

export async function setStarred(id: string, starred: boolean): Promise<boolean> {
  const { error } = await supabase.from("bookmarks").update({ starred }).eq("id", id)
  return !error
}

/** Splits "react, ui , notes" into ["react", "ui", "notes"]. */
export function parseTags(input: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  for (const raw of input.split(/[,\n]/)) {
    const tag = raw.trim().replace(/^#/, "").toLowerCase()
    if (!tag || tag.length > 32 || seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
    if (out.length >= 12) break
  }

  return out
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}
