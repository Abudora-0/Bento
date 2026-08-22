/**
 * Password hashing.
 *
 * PBKDF2 rather than bcrypt, scrypt or argon2, because middleware runs on the
 * Edge runtime where none of those exist and `node:crypto` is unavailable. Web
 * Crypto is the only thing present in both runtimes, and PBKDF2 is the only
 * password function it offers.
 *
 * That is a real tradeoff worth naming: PBKDF2 is weaker per unit of work than
 * argon2, because it is cheap to accelerate on a GPU where argon2 is
 * deliberately memory hard. The iteration count below is OWASP's figure for
 * PBKDF2-HMAC-SHA256, and it costs about 200ms per login, which is the right
 * shape for something a person waits on.
 */

const ITERATIONS = 210_000
const SALT_BYTES = 16
const KEY_BITS = 256

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2))
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits"
  ])

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    KEY_BITS
  )

  return new Uint8Array(bits)
}

/**
 * Returns a self describing string: the algorithm, the cost, the salt and the
 * hash. Storing the parameters alongside the hash is what makes it possible to
 * raise the iteration count later without locking out everyone who signed up
 * before the change.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await derive(password, salt, ITERATIONS)

  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${toHex(hash)}`
}

/**
 * Checks a password against a stored hash.
 *
 * The comparison runs over the full length without short circuiting, so it
 * does not leak how much of the hash matched through timing.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$")
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false

  const iterations = Number(parts[1])
  if (!Number.isInteger(iterations) || iterations < 1000) return false

  if (!/^[0-9a-f]+$/i.test(parts[2]) || !/^[0-9a-f]+$/i.test(parts[3])) return false

  const salt = fromHex(parts[2])
  const expected = fromHex(parts[3])

  const actual = await derive(password, salt, iterations)
  if (actual.length !== expected.length) return false

  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i]
  return diff === 0
}

/** The token the extension sends. Random, not derived from anything. */
export function newApiToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(24)))
}
