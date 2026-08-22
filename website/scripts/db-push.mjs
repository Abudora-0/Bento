/**
 * Applies the schema to whichever database TURSO_DATABASE_URL points at, and
 * reports what is there afterwards.
 *
 * The app deliberately does not create its own tables any more. On local SQLite
 * that was free, the schema ran once when the file was opened. Against Turso it
 * would be a network round trip on every cold start, forever, to re-check
 * tables that already exist. So setup is an explicit step you run once:
 *
 *   npm run db:push
 *
 * Safe to run repeatedly, every statement in the schema is CREATE IF NOT EXISTS.
 */
import { createClient } from "@libsql/client"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url) {
  console.error(
    "Missing TURSO_DATABASE_URL.\n" +
      "Put it in website/.env.local, or set it in the environment before running this."
  )
  process.exit(1)
}

// A remote database needs a token. A local file url, which is what the tests
// and any offline poking use, does not.
const remote = url.startsWith("libsql://") || url.startsWith("https://")
if (remote && !authToken) {
  console.error("Missing TURSO_AUTH_TOKEN. A libsql:// url needs one.")
  process.exit(1)
}

// Never print the token. The url is not secret, the token is.
console.log(`database  ${url}`)
console.log(`token     ${authToken ? `present, ${authToken.length} characters` : "not needed"}`)

const schemaSource = readFileSync(resolve(ROOT, "lib/db/schema.ts"), "utf8")
const match = schemaSource.match(/`([\s\S]*)`/)
if (!match) {
  console.error("Could not find the schema template literal in lib/db/schema.ts.")
  process.exit(1)
}

const db = createClient(remote ? { url, authToken } : { url })

const started = Date.now()
await db.execute("select 1")
console.log(`round trip ${Date.now() - started}ms`)

await db.executeMultiple(match[1])
console.log("schema     applied")

const tables = await db.execute(
  "select name from sqlite_schema where type = 'table' and name not like 'sqlite_%' order by name"
)
const indexes = await db.execute(
  "select name from sqlite_schema where type = 'index' and name not like 'sqlite_%' order by name"
)

console.log(`tables     ${tables.rows.map((r) => r.name).join(", ")}`)
console.log(`indexes    ${indexes.rows.map((r) => r.name).join(", ")}`)

for (const table of ["bookmarks", "folders"]) {
  const { rows } = await db.execute(`select count(*) as n from ${table}`)
  console.log(`${table.padEnd(10)} ${rows[0].n} row(s)`)
}
