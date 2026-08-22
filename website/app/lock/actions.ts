"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { createUser, verifyLogin } from "~/lib/db/users"
import { SESSION_COOKIE, issueSession, sessionCookieOptions } from "~/lib/session"

export type AuthResult = { ok: true } | { ok: false; error: string }

/** Roughly a quarter second, enough to blunt a script hammering the form. */
const REJECT_DELAY_MS = 250

/**
 * Whether to mark the session cookie Secure.
 *
 * Reading NEXT_PUBLIC_SITE_URL alone would be a chicken and egg problem on a
 * first deploy: you cannot know the url until after it deploys, and a cookie
 * without Secure on https is a downgrade nobody would notice. Vercel sets
 * VERCEL_ENV on every deployment and always serves https, so that is the
 * reliable signal, and anything else falls back to the configured origin.
 */
function isSecure(): boolean {
  if (process.env.VERCEL_ENV) return true
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://")
}

async function startSession(userId: string, remember: boolean): Promise<void> {
  const store = await cookies()
  store.set(
    SESSION_COOKIE,
    await issueSession(userId, { remember }),
    sessionCookieOptions(isSecure(), remember)
  )
}

function wantsRemembering(formData: FormData): boolean {
  return formData.get("remember") === "on"
}

/**
 * Signing in.
 *
 * The error never says whether it was the email or the password that was
 * wrong. Saying "no account with that email" would turn the form into a way to
 * find out who has an account here.
 */
export async function signIn(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")

  if (!email || !password) return { ok: false, error: "Fill in both fields." }

  let user
  try {
    user = await verifyLogin(email, password)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." }
  }

  if (!user) {
    await new Promise((resolve) => setTimeout(resolve, REJECT_DELAY_MS))
    return { ok: false, error: "That email and password do not match." }
  }

  await startSession(user.id, wantsRemembering(formData))
  return { ok: true }
}

/**
 * Signing up.
 *
 * Open by default, which is what a portfolio piece wants. Setting
 * BENTO_INVITE_CODE closes it to people who know the code, without having to
 * take the signup form down.
 */
export async function signUp(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")
  const confirm = String(formData.get("confirm") ?? "")

  if (password !== confirm) return { ok: false, error: "Those passwords do not match." }

  const required = process.env.BENTO_INVITE_CODE
  if (required) {
    const given = String(formData.get("invite") ?? "")
    if (given !== required) {
      await new Promise((resolve) => setTimeout(resolve, REJECT_DELAY_MS))
      return { ok: false, error: "That invite code is not right." }
    }
  }

  let result
  try {
    result = await createUser(email, password)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." }
  }

  if (!result.ok) return result

  await startSession(result.user.id, wantsRemembering(formData))
  return { ok: true }
}

/** Whether the signup form should ask for an invite code. */
export async function inviteRequired(): Promise<boolean> {
  return Boolean(process.env.BENTO_INVITE_CODE)
}

/** The manual lock. Drops the cookie and sends you back to the door. */
export async function lockNow(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  redirect("/lock")
}
