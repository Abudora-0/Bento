"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { secretsMatch } from "~/lib/auth"
import { SESSION_COOKIE, issueSession, sessionCookieOptions, username } from "~/lib/session"

export type UnlockResult = { ok: true } | { ok: false; error: string }

/** Roughly a quarter second, enough to blunt a script hammering the form. */
const REJECT_DELAY_MS = 250

function isSecure(): boolean {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://")
}

/**
 * Checks both halves of the lock and opens it.
 *
 * Both comparisons always run even when the first has already failed, and the
 * error never says which half was wrong. Telling someone their username was
 * right would hand them the more guessable half for free.
 */
export async function unlock(formData: FormData): Promise<UnlockResult> {
  const user = String(formData.get("user") ?? "")
  const pass = String(formData.get("pass") ?? "")

  let userOk = false
  let passOk = false

  try {
    const [u, p] = await Promise.all([
      secretsMatch(user, username()),
      secretsMatch(pass, process.env.BENTO_SECRET ?? "")
    ])
    userOk = u
    passOk = p
  } catch {
    // username() throws when BENTO_USER is unset. A misconfigured server
    // refuses rather than opening.
    return { ok: false, error: "This Bento is not configured. Set BENTO_USER and BENTO_SECRET." }
  }

  if (!userOk || !passOk) {
    await new Promise((resolve) => setTimeout(resolve, REJECT_DELAY_MS))
    return { ok: false, error: "That does not open it." }
  }

  const store = await cookies()
  store.set(SESSION_COOKIE, await issueSession(), sessionCookieOptions(isSecure()))

  return { ok: true }
}

/** The manual lock. Drops the cookie and sends you back to the door. */
export async function lockNow(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  redirect("/lock")
}
