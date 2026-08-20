import { saveCapture } from "./lib/api"
import { getActiveTab, grabScreenshot, lastFolder } from "./lib/capture"
import { getConfig } from "./lib/config"

/**
 * Quick capture, the keyboard shortcut path. No popup, no tags, no note, it
 * just exposes the frame and flashes the badge so you know it landed.
 *
 * It files into whichever folder the popup is currently set to, so the
 * shortcut and the popup agree. The server drops a folder that no longer
 * exists rather than failing the capture over it.
 */
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "quick-capture") return

  const config = await getConfig()
  if (!config) {
    await flashBadge("x", "#cc352c")
    return
  }

  const tab = await getActiveTab()
  if (!tab) {
    await flashBadge("x", "#cc352c")
    return
  }

  const [screenshot, folderId] = await Promise.all([grabScreenshot(tab.windowId), lastFolder()])

  const result = await saveCapture(config, {
    url: tab.url,
    title: tab.title,
    faviconUrl: tab.faviconUrl,
    tags: "",
    notes: "",
    screenshot,
    folderId
  })

  if (result.ok) await flashBadge(result.updated ? "+" : "1", "#4c6b3c")
  else await flashBadge("x", "#cc352c")
})

async function flashBadge(text: string, color: string) {
  await chrome.action.setBadgeBackgroundColor({ color })
  await chrome.action.setBadgeText({ text })

  setTimeout(() => {
    void chrome.action.setBadgeText({ text: "" })
  }, 2200)
}
