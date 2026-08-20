import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

/**
 * Api route tests exercise the real SQLite layer rather than mocking it, so
 * each test file gets its own throwaway database. node --test runs each
 * matched file in its own process, so setting BENTO_DATA_DIR here, before the
 * lazy connection in lib/db/client.ts is ever touched, is enough, no other
 * test file's setup can race with it.
 */
export const TEST_SECRET = "test-secret-do-not-use-elsewhere"

export function setUpTempDataDir(): void {
  process.env.BENTO_DATA_DIR = mkdtempSync(join(tmpdir(), "bento-test-"))
  process.env.BENTO_SECRET = TEST_SECRET
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"
}

export function cleanupDataDir(): void {
  const dir = process.env.BENTO_DATA_DIR
  if (!dir) return

  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    // Windows keeps the sqlite file locked for a moment after the process
    // that opened it exits, nothing in here reaches across test files anyway,
    // the OS reclaims temp directories on its own schedule.
  }
}

export function authed(init: RequestInit = {}): RequestInit {
  return { ...init, headers: { ...init.headers, authorization: `Bearer ${TEST_SECRET}` } }
}
