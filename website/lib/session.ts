/**
 * The lock.
 *
 * Bento has one user, so there is still no account system. What this adds over
 * the old Basic Auth is that the gate can close again: the browser prompt kept
 * you signed in for as long as the window stayed open, with no way to lock it
 * behind you on a shared machine.
 *
 * A session is a signed timestamp in a cookie, nothing else. There is no
 * session store, no database write, and nothing to expire server side, because
 * the token carries everything needed to judge it. That keeps this verifiable
 * inside middleware, which matters: middleware runs on the Edge runtime, so
 * everything here uses the Web Crypto global rather than node:crypto, the same
 * constraint that already shaped lib/auth.ts.
 */

export const SESSION_COOKIE = "bento_session"

const DEFAULT_IDLE_MINUTES = 30

/** How long a session may sit untouched before it locks itself. */
export function idleTimeoutMs(): number {
  const raw = Number(process.env.BENTO_LOCK_MINUTES)
  const minutes = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 60 * 24) : DEFAULT_IDLE_MINUTES
  return minutes * 60 * 1000
}

/**
 * The username. Unlike the secret this is allowed to be short, it is a second
 * thing to know rather than a second thing to brute force, so it only has to
 * exist.
 */
export function username(): string {
  const value = process.env.BENTO_USER
  if (!value) {
    throw new Error(
      "Missing BENTO_USER. Set one in website/.env.local. It is the name half of the lock screen, " +
        "the other half is BENTO_SECRET."
    )
  }
  return value
}

function keyMaterial(): string {
  const value = process.env.BENTO_SECRET
  if (!value || value.length < 8) {
    throw new Error(
      "Missing or too short BENTO_SECRET. Set one in website/.env.local, at least 8 characters."
    )
  }
  return value
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(keyMaterial()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  )
}

/** Base64url, because a cookie value cannot carry +, / or = safely. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/*
 * The explicit ArrayBuffer type argument matters: without it TypeScript widens
 * to Uint8Array<ArrayBufferLike>, which crypto.subtle.verify refuses because a
 * SharedArrayBuffer cannot back a BufferSource.
 */
function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    const padded = text.replace(/-/g, "+").replace(/_/g, "/")
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4))

    const bytes = new Uint8Array(new ArrayBuffer(binary.length))
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

/**
 * Issues a token for a session starting now.
 *
 * The payload is just the issue time. Everything else that matters, who you
 * are and whether you knew the secret, was already decided when this was
 * called, and the signature is what makes that decision unforgeable.
 */
export async function issueSession(issuedAt = Date.now()): Promise<string> {
  const payload = toBase64Url(new TextEncoder().encode(String(issuedAt)))
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(payload))

  return `${payload}.${toBase64Url(new Uint8Array(signature))}`
}

export type SessionCheck =
  | { valid: true; issuedAt: number }
  /** Signature was fine but the session sat idle too long. */
  | { valid: false; reason: "expired" }
  /** Missing, malformed, tampered with, or signed with a different secret. */
  | { valid: false; reason: "invalid" }

/**
 * Verifies a token and enforces the idle window.
 *
 * `crypto.subtle.verify` is a constant time comparison, so a wrong signature
 * does not leak how wrong it was. A token signed with an old secret fails here
 * too, which is the behaviour you want: changing BENTO_SECRET logs you out.
 */
export async function readSession(token: string | undefined, now = Date.now()): Promise<SessionCheck> {
  if (!token) return { valid: false, reason: "invalid" }

  const [payload, signature] = token.split(".")
  if (!payload || !signature) return { valid: false, reason: "invalid" }

  const signatureBytes = fromBase64Url(signature)
  if (!signatureBytes) return { valid: false, reason: "invalid" }

  let ok: boolean
  try {
    ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      signatureBytes,
      new TextEncoder().encode(payload)
    )
  } catch {
    // keyMaterial() throws when BENTO_SECRET is unset. Refusing is the only
    // honest answer, letting everyone in because the server is misconfigured
    // would be the worst possible failure mode.
    return { valid: false, reason: "invalid" }
  }

  if (!ok) return { valid: false, reason: "invalid" }

  const payloadBytes = fromBase64Url(payload)
  if (!payloadBytes) return { valid: false, reason: "invalid" }

  const issuedAt = Number(new TextDecoder().decode(payloadBytes))
  if (!Number.isFinite(issuedAt)) return { valid: false, reason: "invalid" }

  // A token issued in the future means the clock moved or someone is playing
  // games. Either way it is not something to trust.
  if (issuedAt > now + 60_000) return { valid: false, reason: "invalid" }

  if (now - issuedAt > idleTimeoutMs()) return { valid: false, reason: "expired" }

  return { valid: true, issuedAt }
}

/** Cookie attributes, shared by the code that sets it and the code that clears it. */
export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/"
    // Deliberately no maxAge or expires. That makes it a session cookie, so
    // closing the browser drops it, which is half of what "nobody else on this
    // device" means. The idle window inside the token does the other half.
  }
}
