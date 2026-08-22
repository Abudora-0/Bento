import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Test setup.
 *
 * These tests run against a real database rather than a mock, because the
 * things worth checking here are things only the engine knows: that json_each
 * finds a tag, that the unique index on url makes a recapture merge, that
 * deleting a folder unfiles its bookmarks. A mock would happily agree with
 * whatever the code believes.
 *
 * libSQL runs in memory, so that stays true without a network or a temp file.
 * node --test gives each file its own process, so one file's database can
 * never leak into another's.
 */
export const TEST_SECRET = "test-secret-do-not-use-elsewhere"
export const TEST_USER = "test-user"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

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
  process.env.BENTO_USER = TEST_USER
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"
  // No blob store in tests. Captures still succeed, they just arrive without
  // a picture, which is a state the frames already handle.
  delete process.env.BLOB_READ_WRITE_TOKEN

  const { db } = await import("./db/client.ts")

  const source = readFileSync(resolve(ROOT, "lib/db/schema.ts"), "utf8")
  const schema = source.match(/`([\s\S]*)`/)
  if (!schema) throw new Error("Could not read the schema out of lib/db/schema.ts")

  await db().executeMultiple(schema[1])
  await db().execute("PRAGMA foreign_keys = ON")
}

export function authed(init: RequestInit = {}): RequestInit {
  return { ...init, headers: { ...init.headers, authorization: `Bearer ${TEST_SECRET}` } }
}
