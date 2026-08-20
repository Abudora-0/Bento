import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"
import { resolve } from "node:path"

import { SCHEMA } from "./schema.ts"

/**
 * Bento is single user and self hosted, so the database is one SQLite file on
 * disk rather than a managed Postgres project. node:sqlite is built into Node
 * 22.5 and later, so this needs no native module and nothing to compile.
 *
 * This needs a writable, persistent filesystem. It will not survive on a
 * platform with an ephemeral or read only filesystem between requests, such as
 * Vercel's serverless functions. Run it somewhere with a real disk: a small
 * VPS, a Fly or Railway instance with a volume, a home server, Docker with a
 * bind mount. See README.md.
 */

function dataDir(): string {
  return resolve(process.env.BENTO_DATA_DIR ?? "./data")
}

function open(): DatabaseSync {
  const dir = dataDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const path = resolve(dir, "bento.sqlite3")
  const instance = new DatabaseSync(path)

  instance.exec("pragma journal_mode = WAL")
  instance.exec("pragma foreign_keys = ON")
  // Two requests writing at the same instant would otherwise fail outright
  // with "database is locked" instead of one briefly waiting its turn.
  instance.exec("pragma busy_timeout = 5000")
  instance.exec(SCHEMA)

  return instance
}

// Next.js hot reloads modules in dev, which would otherwise open a second
// connection to the same file on every save. Stash the singleton on
// globalThis so a reload picks the existing one back up.
const globalForDb = globalThis as unknown as { bentoDb?: DatabaseSync }

/**
 * A lazy handle. Opening eagerly at module load used to mean that merely
 * importing this file, which next build does for every route it statically
 * analyses, touched the database, and touched it from more than one build
 * worker at once. The proxy defers the real DatabaseSync until the first
 * query actually runs, so importing the module has no side effect and every
 * call site below can keep using `db.prepare(...)` unchanged.
 */
export const db: DatabaseSync = new Proxy({} as DatabaseSync, {
  get(_target, prop, receiver) {
    if (!globalForDb.bentoDb) globalForDb.bentoDb = open()

    const instance = globalForDb.bentoDb
    const value = Reflect.get(instance, prop, receiver)
    return typeof value === "function" ? value.bind(instance) : value
  }
})

export function newId(): string {
  return randomUUID()
}

export function now(): string {
  return new Date().toISOString()
}

/** Where screenshot files live on disk, kept next to the database. */
export function screenshotDir(): string {
  const dir = resolve(dataDir(), "screenshots")
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

const SAFE_FILENAME = /^[a-f0-9-]{36}\.jpg$/

/**
 * Resolves a screenshot filename to its path on disk. Only accepts the exact
 * shape saveScreenshot produces, a uuid plus ".jpg", so a filename coming from
 * a request URL cannot walk out of the screenshots directory with "../".
 */
export function screenshotPath(filename: string): string | null {
  if (!SAFE_FILENAME.test(filename)) return null
  return resolve(screenshotDir(), filename)
}
