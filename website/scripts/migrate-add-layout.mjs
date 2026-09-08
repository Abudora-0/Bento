/**
 * One off: adds bookmarks.position and bookmarks.shape to a database created
 * before the sheet could be arranged by hand.
 *
 * db:push is CREATE IF NOT EXISTS, so it sees the bookmarks table, says fine,
 * and leaves it exactly as it was. db:reset would apply the new schema but
 * throw away every bookmark with it. This is the third option, an ALTER that
 * keeps the rows.
 *
 * Safe to run twice: it checks for each column first and adds only what is
 * missing, so a run that fails halfway can simply be run again.
 *
 *   node --env-file-if-exists=.env.local scripts/migrate-add-layout.mjs
 *
 * Both columns are nullable and nothing is backfilled. That is deliberate
 * rather than lazy: SQLite cannot add a NOT NULL column to a populated table
 * without a default, and null already means the right thing in both cases.
 * A null position means follow whichever sort is on, and a null shape means
 * follow the layout cycle. Positions are filled in the first time an account
 * opens its own arrangement, by seedPositions in lib/db/bookmarks.ts, so the
 * numbering happens against the order that account is actually looking at.
 */
import { createClient } from "@libsql/client"

const url = process.env.TURSO_DATABASE_URL
if (!url) {
  console.error("Missing TURSO_DATABASE_URL. Put it in website/.env.local.")
  process.exit(1)
}

const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })

console.log(`database  ${url}`)

const { rows: columns } = await db.execute("pragma table_info(bookmarks)")
if (columns.length === 0) {
  console.error("There is no bookmarks table here. Run npm run db:push first.")
  process.exit(1)
}

const present = new Set(columns.map((column) => column.name))

/*
 * The check constraint is written out here as well as in schema.ts, because a
 * database that goes through this migration and one built fresh from the
 * schema have to end up the same. Without it, an old database would accept a
 * shape a new one refuses, and that difference would only surface as a bug
 * somewhere else entirely.
 */
const ADDITIONS = [
  { name: "position", ddl: "alter table bookmarks add column position integer" },
  {
    name: "shape",
    ddl: "alter table bookmarks add column shape text check (shape is null or shape in ('small', 'wide', 'tall', 'big'))"
  }
]

let added = 0

for (const column of ADDITIONS) {
  if (present.has(column.name)) {
    console.log(`${column.name.padEnd(9)} already present`)
    continue
  }

  await db.execute(column.ddl)
  console.log(`${column.name.padEnd(9)} added`)
  added += 1
}

// The index is CREATE IF NOT EXISTS, so it is safe on every run, and it has to
// exist or the arrangement sort is a full scan of the account's rows.
await db.execute(
  "create index if not exists bookmarks_user_position_idx on bookmarks (user_id, position, id)"
)
console.log("index     bookmarks_user_position_idx ready")

const { rows: counted } = await db.execute("select count(*) as n from bookmarks")
console.log(`\n${added} column(s) added, ${counted[0].n} bookmarks left untouched`)
