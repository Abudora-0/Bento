/**
 * Bento has no accounts. What used to be signing in is now telling the popup
 * where your tray lives and the one secret that gets it in the door, stored in
 * chrome.storage.local so the background worker can reach it too.
 */

export type Config = {
  siteUrl: string
  secret: string
}

const CONFIG_KEY = "bento.config"

export async function getConfig(): Promise<Config | null> {
  const result = await chrome.storage.local.get(CONFIG_KEY)
  const config = result[CONFIG_KEY] as Config | undefined
  return config && config.siteUrl && config.secret ? config : null
}

export async function setConfig(config: Config): Promise<void> {
  await chrome.storage.local.set({
    [CONFIG_KEY]: { siteUrl: config.siteUrl.replace(/\/$/, ""), secret: config.secret }
  })
}

export type ConnectionCheck = { ok: true } | { ok: false; error: string }

/** Tries the simplest authenticated request there is, to check both fields before saving them. */
export async function testConnection(config: Config): Promise<ConnectionCheck> {
  let response: Response

  try {
    response = await fetch(`${config.siteUrl.replace(/\/$/, "")}/api/folders`, {
      headers: { authorization: `Bearer ${config.secret}` }
    })
  } catch {
    return { ok: false, error: "Could not reach that address. Check the url and that the site is running." }
  }

  if (response.status === 401) return { ok: false, error: "That secret was not accepted." }
  if (!response.ok) return { ok: false, error: `The site responded with ${response.status}.` }

  return { ok: true }
}
