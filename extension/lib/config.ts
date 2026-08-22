/**
 * Where your sheet lives, and the token that gets this popup in the door.
 *
 * The token is per account. You generate it on the site under Settings, and it
 * is the only thing the extension ever holds: it is not your password, and
 * regenerating it on the site cuts this browser off without touching the
 * account itself. Stored in chrome.storage.local so the background worker,
 * which handles the keyboard shortcut, can reach it too.
 */

export type Config = {
  siteUrl: string
  token: string
}

const CONFIG_KEY = "bento.config"

export async function getConfig(): Promise<Config | null> {
  const result = await chrome.storage.local.get(CONFIG_KEY)
  const config = result[CONFIG_KEY] as Config | undefined
  return config && config.siteUrl && config.token ? config : null
}

export async function setConfig(config: Config): Promise<void> {
  await chrome.storage.local.set({
    [CONFIG_KEY]: { siteUrl: config.siteUrl.replace(/\/$/, ""), token: config.token }
  })
}

export type ConnectionCheck = { ok: true } | { ok: false; error: string }

/** Tries the simplest authenticated request there is, to check both fields before saving them. */
export async function testConnection(config: Config): Promise<ConnectionCheck> {
  let response: Response

  try {
    response = await fetch(`${config.siteUrl.replace(/\/$/, "")}/api/folders`, {
      headers: { authorization: `Bearer ${config.token}` }
    })
  } catch {
    return { ok: false, error: "Could not reach that address. Check the url and that the site is running." }
  }

  if (response.status === 401) {
    return { ok: false, error: "That token was not accepted. Copy it again from Settings on the site." }
  }
  if (!response.ok) return { ok: false, error: `The site responded with ${response.status}.` }

  return { ok: true }
}
