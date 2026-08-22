import { corsJson } from "./cors.ts"
import { findUserByApiToken, type User } from "./db/users.ts"

/**
 * Who is asking, for the api routes.
 *
 * The extension authenticates with a per user token rather than a shared
 * secret, so this both authenticates and identifies in one step: a token that
 * resolves to nobody is rejected, and a token that resolves tells the route
 * whose bookmarks it is allowed to touch.
 *
 * The site's own pages use a different path entirely, see current-user.ts.
 * Keeping the two apart is what lets the lock change without the extension
 * noticing, and it keeps this file free of next/headers so tests can import a
 * route handler without a request context.
 */
export async function userFromBearer(request: Request): Promise<User | null> {
  const header = request.headers.get("authorization") ?? ""
  const match = /^Bearer (.+)$/.exec(header)
  if (!match) return null

  return findUserByApiToken(match[1].trim())
}

export function unauthorized(request: Request): Response {
  return corsJson(request, { error: "Missing or incorrect token." }, { status: 401 })
}
