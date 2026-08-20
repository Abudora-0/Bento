import { corsJson } from "./cors.ts"

/**
 * Bento is single user, so there is no account system, just one secret shared
 * between this server and whoever is allowed to use it: your own browser (via
 * the Basic Auth prompt in middleware.ts) and the extension (via a bearer
 * token on the api routes it calls).
 *
 * middleware.ts runs on the Edge runtime, which has no node:crypto, so this
 * uses the Web Crypto global (crypto.subtle) instead. It is available in both
 * the Edge runtime and Node, so the same check works in the api routes too.
 */

export function secret(): string {
  const value = process.env.BENTO_SECRET

  if (!value || value.length < 8) {
    throw new Error(
      "Missing or too short BENTO_SECRET. Set one in website/.env.local, at least 8 characters. " +
        "This is the password both your browser and the extension use to reach your tray."
    )
  }

  return value
}

async function sha256(text: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return new Uint8Array(digest)
}

/**
 * Constant time comparison. Hashing both sides to a fixed length first means a
 * length mismatch does not itself leak anything through timing, and the fixed
 * length loop below does not short circuit on the first differing byte.
 */
export async function secretsMatch(a: string, b: string): Promise<boolean> {
  const [left, right] = await Promise.all([sha256(a), sha256(b)])

  let diff = 0
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i]
  return diff === 0
}

/** Checks a request's "Authorization: Bearer <token>" header against the secret. */
export async function hasValidBearer(request: Request): Promise<boolean> {
  const header = request.headers.get("authorization") ?? ""
  const match = /^Bearer (.+)$/.exec(header)
  if (!match) return false

  return secretsMatch(match[1], secret())
}

export function unauthorized(request: Request): Response {
  return corsJson(request, { error: "Missing or incorrect token." }, { status: 401 })
}
