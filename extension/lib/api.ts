import type { Config } from "./config"
import type { Bookmark, Folder } from "./types"

function authedInit(config: Config, init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: { ...(init.headers ?? {}), authorization: `Bearer ${config.secret}` }
  }
}

function url(config: Config, path: string): string {
  return `${config.siteUrl}${path}`
}

export async function listFolders(config: Config): Promise<Folder[]> {
  const response = await fetch(url(config, "/api/folders"), authedInit(config))
  if (!response.ok) return []

  const data = (await response.json()) as { folders: Folder[] }
  return data.folders
}

export async function recentCaptures(config: Config, limit: number): Promise<{ bookmarks: Bookmark[]; total: number }> {
  const response = await fetch(url(config, `/api/bookmarks?limit=${limit}`), authedInit(config))
  if (!response.ok) return { bookmarks: [], total: 0 }

  return (await response.json()) as { bookmarks: Bookmark[]; total: number }
}

export async function setStarred(config: Config, id: string, starred: boolean): Promise<boolean> {
  const response = await fetch(
    url(config, `/api/bookmarks/${id}`),
    authedInit(config, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ starred })
    })
  )

  return response.ok
}

export type CaptureInput = {
  url: string
  title: string
  faviconUrl: string | null
  /** Raw, comma separated. The server owns tag normalisation, there is one implementation of it. */
  tags: string
  notes: string
  screenshot: Blob | null
  folderId: string | null
}

export type CaptureResult =
  | { ok: true; bookmark: Bookmark; updated: boolean; folderWasStale: boolean }
  | { ok: false; error: string }

/**
 * Saves the tab. Re-capturing a page you already have merges into the existing
 * row rather than making a second copy of it, so tags and notes survive.
 */
export async function saveCapture(config: Config, input: CaptureInput): Promise<CaptureResult> {
  const form = new FormData()
  form.set("url", input.url)
  form.set("title", input.title)
  if (input.faviconUrl) form.set("faviconUrl", input.faviconUrl)
  form.set("tags", input.tags)
  form.set("notes", input.notes)
  if (input.folderId) form.set("folderId", input.folderId)
  if (input.screenshot) form.set("screenshot", input.screenshot, "screenshot.jpg")

  let response: Response
  try {
    response = await fetch(url(config, "/api/capture"), authedInit(config, { method: "POST", body: form }))
  } catch {
    return { ok: false, error: "Could not reach the site. Check the connection in settings." }
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    return { ok: false, error: body?.error ?? `The site responded with ${response.status}.` }
  }

  const data = (await response.json()) as { bookmark: Bookmark; updated: boolean; folderWasStale: boolean }
  return { ok: true, ...data }
}
