/**
 * Test setup.
 *
 * These tests run against a real database rather than a mock, because the
 * things worth checking are things only the engine knows: that json_each finds
 * a tag, that the unique index makes a recapture merge, that deleting a folder
 * unfiles its bookmarks, and above all that one account's filter never returns
 * another account's rows. A mock would happily agree with whatever the code
 * believed.
 *
 * libSQL runs in memory, so that stays true without a network or a temp file.
 * node --test gives each file its own process, so one file's database can
 * never leak into another's.
 */
export const TEST_SECRET = "test-secret-do-not-use-elsewhere"

/**
 * Points the app at a fresh in-memory database and applies the schema.
 *
 * Must be awaited before importing anything that touches the database, since
 * the client reads its configuration from the environment on first use.
 */
export async function setUpTestDatabase(): Promise<void> {
  process.env.TURSO_DATABASE_URL = ":memory:"
  delete process.env.TURSO_AUTH_TOKEN
  process.env.BENTO_SECRET = TEST_SECRET
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"
  delete process.env.BENTO_INVITE_CODE
  // No blob store in tests. Captures still succeed, they just arrive without
  // a picture, which is a state the frames already handle.
  delete process.env.BLOB_READ_WRITE_TOKEN

  const { db } = await import("./db/client.ts")
  const { SCHEMA } = await import("./db/schema.ts")

  await db().executeMultiple(SCHEMA)
  await db().execute("PRAGMA foreign_keys = ON")
}

export type TestUser = { id: string; email: string; api_token: string }

/**
 * Creates a user directly, skipping the signup form.
 *
 * The password is short on purpose to keep PBKDF2 cheap across a whole suite,
 * and it goes in through createUser so the stored hash is a real one rather
 * than something the tests invented.
 */
export async function makeUser(email: string): Promise<TestUser> {
  const { createUser } = await import("./db/users.ts")

  const result = await createUser(email, "test-password-long-enough")
  if (!result.ok) throw new Error(`could not create ${email}: ${result.error}`)

  return { id: result.user.id, email: result.user.email, api_token: result.user.api_token }
}

/** A request carrying a specific user's extension token. */
export function authed(token: string, init: RequestInit = {}): RequestInit {
  return { ...init, headers: { ...init.headers, authorization: `Bearer ${token}` } }
}
