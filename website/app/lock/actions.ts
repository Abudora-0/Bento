"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

import { createUser, findLoginCandidate, verifyCandidate } from "~/lib/db/users"
import {
  addressFrom,
  checkSignIn,
  checkSignUp,
  clearSignInFailures,
  describeWait,
  recordAttempt,
  signInBuckets,
  signUpBuckets
} from "~/lib/rate-limit"
import { SESSION_COOKIE, issueSession, sessionCookieOptions } from "~/lib/session"

export type AuthResult = { ok: true } | { ok: false; error: string }

/** Roughly a quarter second, enough to blunt a script hammering the form. */
const REJECT_DELAY_MS = 250

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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

async function callerAddress(): Promise<string> {
  return addressFrom(await headers())
}

/**
 * Signing in.
 *
 * The identifier field takes an email or a username, and the error never says
 * which of the two was wrong, or whether the account exists at all. Saying "no
 * account with that email" would turn the form into a way to find out who has
 * an account here.
 */
export async function signIn(formData: FormData): Promise<AuthResult> {
  const identifier = String(formData.get("identifier") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!identifier || !password) return { ok: false, error: "Fill in both fields." }

  const address = await callerAddress()

  let candidate
  let limit
  try {
    /*
     * Who is being guessed at, resolved before anything is counted. Bucketing
     * on the raw string would hand the same account two allowances, one under
     * its email and one under its username. A miss that resolves to nobody
     * falls back to the string, which is all there is.
     */
    candidate = await findLoginCandidate(identifier)

    /*
     * Checked before the password is verified, not after. A locked out attempt
     * has to be cheap, or the limiter becomes a way to make the server burn
     * 200ms of PBKDF2 on every request it was supposed to be refusing.
     */
    limit = await checkSignIn(candidate?.user.id ?? identifier, address)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." }
  }

  if (!limit.ok) {
    return {
      ok: false,
      error: `Too many attempts. Try again ${describeWait(limit.retryAfterMs)}.`
    }
  }

  const accountKey = candidate?.user.id ?? identifier

  let user
  try {
    user = await verifyCandidate(candidate, password)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." }
  }

  if (!user) {
    await Promise.all([recordAttempt(signInBuckets(accountKey, address)), pause(REJECT_DELAY_MS)])
    return { ok: false, error: "That does not match an account." }
  }

  // A correct password forgets this account's failures, so a person who
  // fumbled a few times is not still counting down afterwards. The address
  // bucket is deliberately left alone, see lib/rate-limit.ts.
  await clearSignInFailures(accountKey)
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
  const username = String(formData.get("username") ?? "")
  const password = String(formData.get("password") ?? "")
  const confirm = String(formData.get("confirm") ?? "")

  if (password !== confirm) return { ok: false, error: "Those passwords do not match." }

  const address = await callerAddress()

  let limit
  try {
    limit = await checkSignUp(address)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." }
  }

  if (!limit.ok) {
    return {
      ok: false,
      error: `That is a lot of new accounts from one place. Try again ${describeWait(limit.retryAfterMs)}.`
    }
  }

  const required = process.env.BENTO_INVITE_CODE
  if (required) {
    const given = String(formData.get("invite") ?? "")
    if (!sameCode(given, required)) {
      await Promise.all([recordAttempt(signUpBuckets(address)), pause(REJECT_DELAY_MS)])
      return { ok: false, error: "That invite code is not right." }
    }
  }

  let result
  try {
    result = await createUser(email, username, password)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." }
  }

  if (!result.ok) return result

  // Counted on success too, so the limit is on accounts created rather than on
  // failures, which is the thing worth capping here.
  await recordAttempt(signUpBuckets(address))
  await startSession(result.user.id, wantsRemembering(formData))
  return { ok: true }
}

/**
 * Constant time comparison for the invite code.
 *
 * A low value secret, but comparing it with === leaks its length and its
 * matching prefix through timing, and there is no reason to write the leaky
 * version when the careful one is four lines.
 */
function sameCode(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given)
  const b = new TextEncoder().encode(expected)

  let diff = a.length ^ b.length
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  }

  return diff === 0
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
