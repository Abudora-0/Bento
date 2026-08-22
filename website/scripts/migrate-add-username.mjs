/**
 * One off: adds users.username to a database created before it existed.
 *
 * db:push is CREATE IF NOT EXISTS, so it sees the users table, says fine, and
 * leaves it exactly as it was. db:reset would apply the new schema but throw
 * away every account with it. This is the third option, an ALTER that keeps
 * the rows.
 *
 * Safe to run twice: it checks for the column first and does nothing if it is
 * already there.
 *
 *   node --env-file-if-exists=.env.local scripts/migrate-add-username.mjs
 *
 * Existing accounts get a username derived from the local part of their email,
 * with a number appended if that collides with somebody else's. Change it
 * afterwards by hand if you do not like what it picked.
 */
import { createClient } from "@libsql/client"

const url = process.env.TURSO_DATABASE_URL
if (!url) {
  console.error("Missing TURSO_DATABASE_URL. Put it in website/.env.local.")
  process.exit(1)
}

const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })

console.log(`database  ${url}`)

const { rows: columns } = await db.execute("pragma table_info(users)")
if (columns.length === 0) {
  console.error("There is no users table here. Run npm run db:push first.")
  process.exit(1)
}

if (columns.some((c) => c.name === "username")) {
  console.log("username   already present, nothing to do")
  process.exit(0)
}

/*
 * Added without NOT NULL, because SQLite cannot add a NOT NULL column to a
 * table that already has rows unless it is given a default, and a default
 * would have to be the same string for everyone, which the unique index would
 * then reject. So: add it nullable, fill it in, then add the index.
 */
await db.execute("alter table users add column username text")
console.log("column     added")

const { rows: users } = await db.execute("select id, email from users order by created_at")

const taken = new Set()

for (const user of users) {
  const base =
    String(user.email)
      .split("@")[0]
      .replace(/[^a-zA-Z0-9_.-]/g, "")
      .replace(/^[^a-zA-Z0-9]+/, "")
      .slice(0, 24) || "user"

  let name = base
  let n = 1
  while (taken.has(name.toLowerCase())) {
    const suffix = String(++n)
    name = base.slice(0, 24 - suffix.length) + suffix
  }
  taken.add(name.toLowerCase())

  await db.execute({ sql: "update users set username = ? where id = ?", args: [name, user.id] })
  console.log(`  ${user.email}  ->  ${name}`)
}

await db.execute("create unique index if not exists users_username_key on users (username collate nocase)")
console.log("index      created")

console.log(`\nBackfilled ${users.length} account(s). Run npm run db:push to pick up anything else new.`)
console.log(
  "\nNote: the column is nullable here, where a freshly pushed schema declares it NOT NULL.\n" +
    "SQLite cannot add a NOT NULL column to a populated table without a default, and a shared\n" +
    "default would collide with the unique index. Every row is filled and the app always sends\n" +
    "a name, so the difference is cosmetic, but it is a difference. A reset removes it."
)
