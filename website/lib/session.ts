/**
 * Sessions.
 *
 * A session is a signed payload in a cookie and nothing else. There is no
 * session store and no database write, because the token carries everything
 * needed to judge it, which is what makes it verifiable inside middleware.
 *
 * Middleware runs on the Edge runtime, so everything here uses the Web Crypto
 * global rather than node:crypto. Reaching for node:crypto in this file breaks
 * the build in a way the type checker will not catch.
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
 * How long a "stay signed in" session lasts.
 *
 * The idle window still applies inside it. This only decides how long the
 * cookie itself survives, which is what lets a session outlive closing the
 * browser.
 */
export function rememberMs(): number {
  return 30 * 24 * 60 * 60 * 1000
}

function signingKeyMaterial(): string {
  const value = process.env.BENTO_SECRET

  if (!value || value.length < 8) {
    throw new Error(
      "Missing or too short BENTO_SECRET. It is the key every session cookie is signed with, " +
        "so it needs to be long and random. Set one in website/.env.local."
    )
  }

  return value
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingKeyMaterial()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  )
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/*
 * The explicit ArrayBuffer type argument matters: without it TypeScript widens
 * to Uint8Array<ArrayBufferLike>, which crypto.subtle refuses because a
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

type Payload = {
  /** Who this session belongs to. */
  u: string
  /** Issued at, milliseconds. */
  t: number
  /** Whether it should survive closing the browser. */
  r?: 1
}

export async function issueSession(
  userId: string,
  options: { remember?: boolean; issuedAt?: number } = {}
): Promise<string> {
  const payload: Payload = { u: userId, t: options.issuedAt ?? Date.now() }
  if (options.remember) payload.r = 1

  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(encoded))

  return `${encoded}.${toBase64Url(new Uint8Array(signature))}`
}

export type SessionCheck =
  | { valid: true; userId: string; issuedAt: number; remember: boolean }
  /** Signature was fine but the session sat idle too long. */
  | { valid: false; reason: "expired" }
  /** Missing, malformed, tampered with, or signed with a different secret. */
  | { valid: false; reason: "invalid" }

/**
 * Verifies a token and enforces the idle window.
 *
 * `crypto.subtle.verify` is a constant time comparison, so a wrong signature
 * does not leak how wrong it was. A token signed with an old secret fails here
 * too, which is the behaviour you want: rotating BENTO_SECRET signs everybody
 * out rather than silently keeping them in.
 */
export async function readSession(token: string | undefined, now = Date.now()): Promise<SessionCheck> {
  if (!token) return { valid: false, reason: "invalid" }

  const [encoded, signature] = token.split(".")
  if (!encoded || !signature) return { valid: false, reason: "invalid" }

  const signatureBytes = fromBase64Url(signature)
  if (!signatureBytes) return { valid: false, reason: "invalid" }

  let ok: boolean
  try {
    ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      signatureBytes,
      new TextEncoder().encode(encoded)
    )
  } catch {
    // signingKeyMaterial() throws when BENTO_SECRET is unset. Refusing is the
    // only honest answer, letting everyone in because the server is
    // misconfigured would be the worst possible failure mode.
    return { valid: false, reason: "invalid" }
  }

  if (!ok) return { valid: false, reason: "invalid" }

  const payloadBytes = fromBase64Url(encoded)
  if (!payloadBytes) return { valid: false, reason: "invalid" }

  let payload: Payload
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as Payload
  } catch {
    return { valid: false, reason: "invalid" }
  }

  if (typeof payload.u !== "string" || !payload.u) return { valid: false, reason: "invalid" }
  if (!Number.isFinite(payload.t)) return { valid: false, reason: "invalid" }

  // A token issued in the future means the clock moved or someone is playing
  // games. Either way it is not something to trust.
  if (payload.t > now + 60_000) return { valid: false, reason: "invalid" }

  if (now - payload.t > idleTimeoutMs()) return { valid: false, reason: "expired" }

  return { valid: true, userId: payload.u, issuedAt: payload.t, remember: payload.r === 1 }
}

/** Cookie attributes, shared by the code that sets it and the code that clears it. */
export function sessionCookieOptions(secure: boolean, remember = false) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    /*
     * Without maxAge this is a session cookie, so closing the browser drops it.
     * "Stay signed in" is exactly the choice to give it a lifetime instead. The
     * idle window inside the token still applies either way, so remembering
     * does not mean never locking.
     */
    ...(remember ? { maxAge: Math.floor(rememberMs() / 1000) } : {})
  }
}
