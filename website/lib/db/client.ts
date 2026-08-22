import { randomUUID } from "node:crypto"

import { createClient, type Client, type InStatement } from "@libsql/client"

/**
 * The database handle.
 *
 * Bento used to keep a SQLite file on disk, which was the right shape for it
 * until it needed to run somewhere without a disk. Turso is the same engine
 * reached over the network, so the schema in schema.ts applies verbatim,
 * `json_each` and `collate nocase` and all.
 *
 * What changes is the cost model. A local query was measured in microseconds,
 * so making five of them to render a page was free. Each one is now a network
 * round trip, so anything that used to be several queries in a row should go
 * through `readBatch` below and become one.
 */

function connectionConfig() {
  const url = process.env.TURSO_DATABASE_URL

  if (!url) {
    throw new Error(
      "Missing TURSO_DATABASE_URL. Set it in website/.env.local for local work, " +
        "or in the project's environment variables once deployed."
    )
  }

  // A libsql:// or https:// url is remote and needs a token. A file: url is
  // local, which is what the tests and any offline poking use.
  const remote = url.startsWith("libsql://") || url.startsWith("https://")
  const authToken = process.env.TURSO_AUTH_TOKEN

  if (remote && !authToken) {
    throw new Error("Missing TURSO_AUTH_TOKEN. A remote Turso url needs one.")
  }

  return remote ? { url, authToken } : { url }
}

// Next hot reloads modules in development, and would otherwise build a new
// client on every save. Stashing it on globalThis lets a reload pick up the
// existing one.
const globalForDb = globalThis as unknown as { bentoDb?: Client }

/**
 * Built on first use rather than at module load. `next build` imports every
 * route it statically analyses, and constructing the client then would mean
 * the build failing on a machine that has no database credentials, which is
 * exactly what CI is.
 */
export function db(): Client {
  if (!globalForDb.bentoDb) globalForDb.bentoDb = createClient(connectionConfig())
  return globalForDb.bentoDb
}

/**
 * Sends several reads as one round trip.
 *
 * Worth using anywhere a page needs more than one query. Measured against a
 * Mumbai database from a laptop in Pakistan, five sequential reads took about
 * 400ms and the same five batched took about 150ms.
 */
export function readBatch(statements: InStatement[]) {
  return db().batch(statements, "read")
}

export function newId(): string {
  return randomUUID()
}

export function now(): string {
  return new Date().toISOString()
}
