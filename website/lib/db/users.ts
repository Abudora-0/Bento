import { hashPassword, newApiToken, verifyPassword } from "~/lib/password"

import { db, newId, now } from "./client.ts"

export type User = {
  id: string
  email: string
  username: string
  api_token: string
  created_at: string
}

type Row = Record<string, unknown>

function rowToUser(row: Row): User {
  return {
    id: String(row.id),
    email: String(row.email),
    username: String(row.username),
    api_token: String(row.api_token),
    created_at: String(row.created_at)
  }
}

/*
 * Every read names its columns rather than selecting *. password_hash lives on
 * this table, and a select * that gets handed to rowToUser today is a select *
 * that gets handed to a JSON response tomorrow.
 */
const USER_COLUMNS = "id, email, username, api_token, created_at"

export type SignUpResult = { ok: true; user: User } | { ok: false; error: string }

/** Normalised once, here, so lookups and storage can never disagree about case. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Usernames keep the capitals you typed and are matched without them.
 *
 * The charset deliberately excludes "@". Sign in takes one field that accepts
 * either an email or a username, and telling them apart is only unambiguous
 * while no username can look like an address.
 */
export function normalizeUsername(username: string): string {
  return username.trim()
}

export function validateUsername(username: string): string | null {
  const clean = normalizeUsername(username)

  if (clean.length < 3) return "Usernames need at least 3 characters."
  if (clean.length > 24) return "Usernames stop at 24 characters."
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(clean)) {
    return "Use letters, numbers, and . _ - only, starting with a letter or number."
  }
  if (clean.includes("@")) return "Usernames cannot contain @."

  return null
}

export function validateCredentials(email: string, password: string): string | null {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "That does not look like an email address."
  if (password.length < 10) return "Use a password of at least 10 characters."
  if (password.length > 200) return "That password is too long."
  return null
}

/**
 * Refuses a password that is just one of the other two fields.
 *
 * Not a strength meter. A length floor plus a real KDF is most of what matters,
 * and the rest of a strength meter is theatre. But a password that is literally
 * the username defeats the hashing entirely, since guessing it needs no list.
 */
export function passwordEchoesCredentials(password: string, email: string, username: string): boolean {
  const lower = password.trim().toLowerCase()

  return (
    lower === email.trim().toLowerCase() ||
    lower === username.trim().toLowerCase() ||
    lower === email.trim().toLowerCase().split("@")[0]
  )
}

export async function createUser(email: string, username: string, password: string): Promise<SignUpResult> {
  const cleanEmail = normalizeEmail(email)
  const cleanUsername = normalizeUsername(username)

  const problem =
    validateUsername(cleanUsername) ??
    validateCredentials(cleanEmail, password) ??
    (passwordEchoesCredentials(password, cleanEmail, cleanUsername)
      ? "Pick a password that is not your username or your email."
      : null)

  if (problem) return { ok: false, error: problem }

  const id = newId()

  try {
    await db().execute({
      sql: "insert into users (id, email, username, password_hash, api_token, created_at) values (?, ?, ?, ?, ?, ?)",
      args: [id, cleanEmail, cleanUsername, await hashPassword(password), newApiToken(), now()]
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    // Which field collided is worth saying. It is not a disclosure a signup
    // form can avoid anyway, since refusing the name at all reveals it is
    // taken, and a vague "something is taken" just makes it unusable.
    if (/UNIQUE constraint failed/i.test(message)) {
      if (/username/i.test(message)) return { ok: false, error: "That username is taken." }
      return { ok: false, error: "There is already an account with that email." }
    }
    return { ok: false, error: message }
  }

  return { ok: true, user: (await findUserById(id)) as User }
}

export async function findUserById(id: string): Promise<User | null> {
  const { rows } = await db().execute({
    sql: `select ${USER_COLUMNS} from users where id = ?`,
    args: [id]
  })
  return rows.length > 0 ? rowToUser(rows[0] as Row) : null
}

/** Resolves the bearer token the extension sends to whoever owns it. */
export async function findUserByApiToken(token: string): Promise<User | null> {
  const { rows } = await db().execute({
    sql: `select ${USER_COLUMNS} from users where api_token = ?`,
    args: [token]
  })
  return rows.length > 0 ? rowToUser(rows[0] as Row) : null
}

export type LoginCandidate = { user: User; passwordHash: string }

/**
 * Finds whoever an email or a username belongs to, without checking anything.
 *
 * One field takes both, because making someone remember which one they signed
 * up with is a worse experience than one query with two predicates. They are
 * both unique, and a username cannot contain "@", so a single lookup is
 * unambiguous.
 *
 * Split out from the verification because the rate limiter needs to know which
 * account is being guessed at before it decides whether to let the guess
 * through, and it has to count the account rather than the string that was
 * typed. Otherwise signing in by email and by username would be two separate
 * allowances for the same account.
 */
export async function findLoginCandidate(identifier: string): Promise<LoginCandidate | null> {
  const clean = identifier.trim()
  if (!clean) return null

  const { rows } = await db().execute({
    sql: `select ${USER_COLUMNS}, password_hash from users where email = ? collate nocase or username = ? collate nocase`,
    args: [clean.toLowerCase(), clean]
  })

  if (rows.length === 0) return null

  const row = rows[0] as Row
  return { user: rowToUser(row), passwordHash: String(row.password_hash) }
}

/**
 * Checks a password against a candidate, or against nothing.
 *
 * Passing null still runs a hash before answering. Without that, an unknown
 * account would return in a millisecond and a wrong password in two hundred,
 * which tells an attacker which half to keep guessing.
 */
export async function verifyCandidate(
  candidate: LoginCandidate | null,
  password: string
): Promise<User | null> {
  if (!candidate) {
    await verifyPassword(password, DUMMY_HASH)
    return null
  }

  return (await verifyPassword(password, candidate.passwordHash)) ? candidate.user : null
}

/** The two steps together, for callers with no reason to separate them. */
export async function verifyLogin(identifier: string, password: string): Promise<User | null> {
  return verifyCandidate(await findLoginCandidate(identifier), password)
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
