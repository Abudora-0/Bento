import { db, newId } from "./db/client.ts"

/**
 * Slowing down a guessing run against the lock.
 *
 * PBKDF2 at 210,000 iterations already costs an attacker about 200ms a guess,
 * but that is the server's 200ms, not theirs. Without a counter, a script can
 * keep a function instance busy indefinitely and work through a word list at
 * whatever rate the platform will scale to. So attempts are counted.
 *
 * The counter lives in the database rather than in a module variable, because
 * this runs serverless: two requests can land on two instances that share no
 * memory, and any instance can be discarded between requests. A module level
 * Map would silently reset and look like it was working.
 *
 * Two buckets, counted separately and both enforced:
 *
 *   id:<account key>   one account being guessed at from anywhere
 *   ip:<address>       one address working through many accounts
 *
 * Neither alone is enough. Counting only the account lets a spray attack try
 * one password against every account it can name, and counting only the
 * address lets a botnet spread a single account's guesses thin.
 *
 * The account key is the user's id when the identifier resolves to a real
 * account, and the typed string when it does not. That distinction matters:
 * sign in accepts an email or a username, and bucketing on whichever one was
 * typed would give the same account two separate allowances to somebody who
 * knows both.
 */

const WINDOW_MS = 15 * 60 * 1000

/** Per account being guessed at. Low, because a person who knows their own password does not miss eight times. */
const MAX_PER_IDENTIFIER = 8

/** Per address. Higher, since a household or an office can share one. */
const MAX_PER_ADDRESS = 25

/** New accounts from one address, over a longer window. */
const SIGNUP_WINDOW_MS = 60 * 60 * 1000
const MAX_SIGNUPS_PER_ADDRESS = 5

export type RateVerdict = { ok: true } | { ok: false; retryAfterMs: number }

/**
 * The address the request came from.
 *
 * Behind Vercel the socket address is always the proxy, so the real one is in
 * `x-forwarded-for`, leftmost entry. That header is caller supplied and
 * trivially spoofed when nothing is in front of the app, which is worth being
 * honest about: the address bucket is a speed bump, and the identifier bucket
 * is the one that actually protects a specific account, because an attacker
 * cannot spoof away the account they are trying to get into.
 */
export function addressFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }

  return headers.get("x-real-ip")?.trim() || "unknown"
}

async function countSince(bucket: string, since: number): Promise<number> {
  const { rows } = await db().execute({
    sql: "select count(*) as n from auth_attempts where bucket = ? and at > ?",
    args: [bucket, since]
  })

  return Number((rows[0] as Record<string, unknown>).n)
}

async function oldestSince(bucket: string, since: number): Promise<number> {
  const { rows } = await db().execute({
    sql: "select min(at) as oldest from auth_attempts where bucket = ? and at > ?",
    args: [bucket, since]
  })

  const oldest = (rows[0] as Record<string, unknown>).oldest
  return oldest === null ? Date.now() : Number(oldest)
}

/**
 * Whether this sign in attempt is allowed to proceed.
 *
 * Called before the password is checked, so a locked out attempt costs one
 * cheap read rather than a full PBKDF2 derivation. That is the point: the
 * limiter has to be cheaper than the thing it is protecting, or it becomes the
 * denial of service it was meant to prevent.
 */
export async function checkSignIn(accountKey: string, address: string): Promise<RateVerdict> {
  const since = Date.now() - WINDOW_MS
  const idBucket = accountBucket(accountKey)
  const ipBucket = `ip:${address}`

  const [byIdentifier, byAddress] = await Promise.all([
    countSince(idBucket, since),
    countSince(ipBucket, since)
  ])

  if (byIdentifier < MAX_PER_IDENTIFIER && byAddress < MAX_PER_ADDRESS) return { ok: true }

  // The window slides, so the wait is until the oldest attempt in it ages out,
  // not a flat fifteen minutes from now.
  const blocking = byIdentifier >= MAX_PER_IDENTIFIER ? idBucket : ipBucket
  const oldest = await oldestSince(blocking, since)

  return { ok: false, retryAfterMs: Math.max(1000, oldest + WINDOW_MS - Date.now()) }
}

export async function checkSignUp(address: string): Promise<RateVerdict> {
  const since = Date.now() - SIGNUP_WINDOW_MS
  const bucket = `signup:${address}`

  if ((await countSince(bucket, since)) < MAX_SIGNUPS_PER_ADDRESS) return { ok: true }

  const oldest = await oldestSince(bucket, since)
  return { ok: false, retryAfterMs: Math.max(1000, oldest + SIGNUP_WINDOW_MS - Date.now()) }
}

/**
 * Records attempts against every bucket named, and prunes what has aged out.
 *
 * The prune rides along on a write that was happening anyway rather than
 * running on a schedule, because this project has nowhere to put a scheduled
 * job and the table is only ever written on a failure.
 */
export async function recordAttempt(buckets: string[]): Promise<void> {
  const at = Date.now()
  const stale = at - Math.max(WINDOW_MS, SIGNUP_WINDOW_MS)

  await db().batch(
    [
      ...buckets.map((bucket) => ({
        sql: "insert into auth_attempts (id, bucket, at) values (?, ?, ?)",
        args: [newId(), bucket, at]
      })),
      { sql: "delete from auth_attempts where at < ?", args: [stale] }
    ],
    "write"
  )
}

function accountBucket(accountKey: string): string {
  return `id:${accountKey.trim().toLowerCase()}`
}

export function signInBuckets(accountKey: string, address: string): string[] {
  return [accountBucket(accountKey), `ip:${address}`]
}

export function signUpBuckets(address: string): string[] {
  return [`signup:${address}`]
}

/**
 * Forgets an account's failures after a correct password.
 *
 * Only the identifier bucket, never the address. Someone who guesses their way
 * into one account should not get the address counter wiped for the next.
 */
export async function clearSignInFailures(accountKey: string): Promise<void> {
  await db().execute({
    sql: "delete from auth_attempts where bucket = ?",
    args: [accountBucket(accountKey)]
  })
}

/** "in about 4 minutes", for a message a person reads rather than a header. */
export function describeWait(ms: number): string {
  const minutes = Math.ceil(ms / 60_000)
  if (minutes <= 1) return "in about a minute"
  if (minutes < 60) return `in about ${minutes} minutes`

  const hours = Math.ceil(minutes / 60)
  return hours === 1 ? "in about an hour" : `in about ${hours} hours`
}
