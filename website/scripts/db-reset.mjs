/**
 * Drops every table and applies the schema again.
 *
 * `db:push` is CREATE IF NOT EXISTS, which means it can add a table but can
 * never change one that already exists. A migration that adds a column to a
 * live table therefore needs either an ALTER by hand or this, which is the
 * blunt option: throw the tables away and rebuild them.
 *
 * It refuses to run when there is anything in them. Pass --force to override
 * that, and understand that --force is not recoverable.
 */
import { createClient } from "@libsql/client"

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url) {
  console.error("Missing TURSO_DATABASE_URL. Put it in website/.env.local.")
  process.exit(1)
}

const force = process.argv.includes("--force")
const db = createClient({ url, authToken })

console.log(`database  ${url}`)

const { rows: tables } = await db.execute(
  "select name from sqlite_schema where type = 'table' and name not like 'sqlite_%' order by name"
)

if (tables.length === 0) {
  console.log("nothing to drop, the database is already empty")
} else {
  let total = 0
  for (const { name } of tables) {
    const { rows } = await db.execute(`select count(*) as n from "${name}"`)
    const n = Number(rows[0].n)
    total += n
    console.log(`  ${name}  ${n} rows`)
  }

  if (total > 0 && !force) {
    console.error(
      `\nRefusing to drop ${total} rows.\n` +
        "If you really mean it, run the same command again with --force. There is no undo."
    )
    process.exit(1)
  }

  // Foreign keys off for the duration, so the drop order cannot matter.
  await db.execute("PRAGMA foreign_keys = OFF")
  for (const { name } of tables) {
    await db.execute(`drop table if exists "${name}"`)
    console.log(`dropped   ${name}`)
  }
}

console.log("\nNow run: npm run db:push")
