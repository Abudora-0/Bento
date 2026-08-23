/**
 * Where the extension lives.
 *
 * One place, because these urls appear on the settings page, in the empty
 * sheet, and in the readme, and a dead install link is the kind of thing
 * nobody notices until somebody tries to use it.
 *
 * The store listing is deliberately optional. Bento ships from a GitHub
 * release first, which costs nothing and needs no review, and a store adds a
 * one click install on top of that rather than replacing it. When the Edge
 * listing goes live, set NEXT_PUBLIC_EXTENSION_STORE_URL and every surface
 * picks it up.
 */

export const REPO_URL = "https://github.com/Abudora-0/Bento"

/** Always resolves to the newest release, so it survives every version bump. */
export const EXTENSION_RELEASE_URL = `${REPO_URL}/releases/latest`

/** The store listing, once there is one. */
export const EXTENSION_STORE_URL = process.env.NEXT_PUBLIC_EXTENSION_STORE_URL ?? null

export type InstallRoute = { href: string; label: string; store: boolean }

/**
 * The best available way to install, and how to describe it.
 *
 * A store listing is one click and updates itself, so it wins whenever it
 * exists. The release zip works everywhere and always, so it is the fallback
 * and never disappears from the instructions entirely.
 */
export function installRoute(): InstallRoute {
  if (EXTENSION_STORE_URL) return { href: EXTENSION_STORE_URL, label: "Add to your browser", store: true }
  return { href: EXTENSION_RELEASE_URL, label: "Download the extension", store: false }
}
