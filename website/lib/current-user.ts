import { cookies } from "next/headers"

import { findUserById, type User } from "./db/users.ts"
import { SESSION_COOKIE, readSession } from "./session.ts"

/**
 * The signed in user, for server components and server actions.
 *
 * Kept apart from auth.ts because this reaches for next/headers, which only
 * works inside a request. The api routes have no use for it, and keeping it
 * out of their import graph means a test can call a route handler with a plain
 * Request and no request context at all.
 */
export async function currentUser(): Promise<User | null> {
  const store = await cookies()
  const session = await readSession(store.get(SESSION_COOKIE)?.value)

  if (!session.valid) return null
  return findUserById(session.userId)
}

/**
 * The same, but throwing rather than returning null.
 *
 * Middleware turns away anyone without a valid session before a page renders,
 * so getting here and finding nobody means something is wrong rather than that
 * the visitor is signed out. Failing loudly beats rendering an empty sheet that
 * looks like their bookmarks vanished.
 */
export async function requireUser(): Promise<User> {
  const user = await currentUser()
  if (!user) throw new Error("Not signed in.")
  return user
}
