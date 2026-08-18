import { getActiveTab, grabScreenshot, saveCapture } from "./lib/capture"

/**
 * Quick capture, the keyboard shortcut path. No popup, no tags, no note, it
 * just exposes the frame and flashes the badge so you know it landed.
 */
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "quick-capture") return

  const tab = await getActiveTab()
  if (!tab) {
    await flashBadge("x", "#cc352c")
    return
  }

  const screenshot = await grabScreenshot(tab.windowId)

  const result = await saveCapture({
    url: tab.url,
    title: tab.title,
    faviconUrl: tab.faviconUrl,
    tags: [],
    notes: "",
    screenshot
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
