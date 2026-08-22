import { hashPassword, newApiToken, verifyPassword } from "~/lib/password"

import { db, newId, now } from "./client.ts"

export type User = {
  id: string
  email: string
  api_token: string
  created_at: string
}

type Row = Record<string, unknown>

function rowToUser(row: Row): User {
  return {
    id: String(row.id),
    email: String(row.email),
    api_token: String(row.api_token),
    created_at: String(row.created_at)
  }
}

export type SignUpResult = { ok: true; user: User } | { ok: false; error: string }

/** Normalised once, here, so lookups and storage can never disagree about case. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function validateCredentials(email: string, password: string): string | null {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "That does not look like an email address."
  if (password.length < 10) return "Use a password of at least 10 characters."
  if (password.length > 200) return "That password is too long."
  return null
}

export async function createUser(email: string, password: string): Promise<SignUpResult> {
  const clean = normalizeEmail(email)

  const problem = validateCredentials(clean, password)
  if (problem) return { ok: false, error: problem }

  const id = newId()

  try {
    await db().execute({
      sql: "insert into users (id, email, password_hash, api_token, created_at) values (?, ?, ?, ?, ?)",
      args: [id, clean, await hashPassword(password), newApiToken(), now()]
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/UNIQUE constraint failed/i.test(message)) {
      return { ok: false, error: "There is already an account with that email." }
    }
    return { ok: false, error: message }
  }

  return { ok: true, user: (await findUserById(id)) as User }
}

export async function findUserById(id: string): Promise<User | null> {
  const { rows } = await db().execute({
    sql: "select id, email, api_token, created_at from users where id = ?",
    args: [id]
  })
  return rows.length > 0 ? rowToUser(rows[0] as Row) : null
}

/** Resolves the bearer token the extension sends to whoever owns it. */
export async function findUserByApiToken(token: string): Promise<User | null> {
  const { rows } = await db().execute({
    sql: "select id, email, api_token, created_at from users where api_token = ?",
    args: [token]
  })
  return rows.length > 0 ? rowToUser(rows[0] as Row) : null
}

/**
 * Checks an email and password.
 *
 * When the email is unknown this still runs a hash before answering. Without
 * that, a wrong email would return in a millisecond and a wrong password in
 * two hundred, which tells an attacker which half to keep guessing.
 */
export async function verifyLogin(email: string, password: string): Promise<User | null> {
  const clean = normalizeEmail(email)

  const { rows } = await db().execute({
    sql: "select id, email, api_token, created_at, password_hash from users where email = ? collate nocase",
    args: [clean]
  })

  if (rows.length === 0) {
    await verifyPassword(password, DUMMY_HASH)
    return null
  }

  const row = rows[0] as Row
  const ok = await verifyPassword(password, String(row.password_hash))

  return ok ? rowToUser(row) : null
}

export async function regenerateApiToken(userId: string): Promise<string | null> {
  const token = newApiToken()

  const result = await db().execute({
    sql: "update users set api_token = ? where id = ?",
    args: [token, userId]
  })

  return result.rowsAffected > 0 ? token : null
}

export async function countUsers(): Promise<number> {
  const { rows } = await db().execute("select count(*) as n from users")
  return Number((rows[0] as Row).n)
}

/**
 * A real hash of a throwaway password, used only to burn the same time a real
 * verification would when the email does not exist. Its plaintext is nothing
 * and it is never compared against anything a user typed.
 */
const DUMMY_HASH =
  "pbkdf2$210000$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000"
