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

const LAST_FOLDER_KEY = "bento.lastFolderId"

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

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}
