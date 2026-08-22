import type { Folder } from "~/types/db"

import { db, newId, now } from "./client.ts"

export type WriteResult = { ok: true; folder: Folder } | { ok: false; error: string }

type Row = Record<string, unknown>

export function rowToFolder(row: Row): Folder {
  return {
    id: String(row.id),
    name: String(row.name),
    created_at: String(row.created_at)
  }
}

/*
 * Every function here takes a userId, and every statement filters on it. That
 * is the whole of the isolation model: there is no row level security to fall
 * back on, so a query that forgets the filter is a data leak between accounts.
 * The updates and deletes carry it too, so knowing another person's folder id
 * still does not let you touch it.
 */

export const LIST_FOLDERS_SQL = "select * from folders where user_id = ? order by name collate nocase"

export async function listFolders(userId: string): Promise<Folder[]> {
  const { rows } = await db().execute({ sql: LIST_FOLDERS_SQL, args: [userId] })
  return rows.map((row) => rowToFolder(row as Row))
}

export async function getFolder(userId: string, id: string): Promise<Folder | null> {
  const { rows } = await db().execute({
    sql: "select * from folders where id = ? and user_id = ?",
    args: [id, userId]
  })
  return rows.length > 0 ? rowToFolder(rows[0] as Row) : null
}

export async function folderExists(userId: string, id: string): Promise<boolean> {
  const { rows } = await db().execute({
    sql: "select 1 from folders where id = ? and user_id = ?",
    args: [id, userId]
  })
  return rows.length > 0
}

export async function createFolder(userId: string, name: string): Promise<WriteResult> {
  const id = newId()

  try {
    await db().execute({
      sql: "insert into folders (id, user_id, name, created_at) values (?, ?, ?, ?)",
      args: [id, userId, name, now()]
    })
  } catch (err) {
    return { ok: false, error: friendlyError(err) }
  }

  return { ok: true, folder: (await getFolder(userId, id)) as Folder }
}

export async function renameFolder(userId: string, id: string, name: string): Promise<WriteResult> {
  try {
    const result = await db().execute({
      sql: "update folders set name = ? where id = ? and user_id = ?",
      args: [name, id, userId]
    })
    if (result.rowsAffected === 0) return { ok: false, error: "That folder no longer exists." }
  } catch (err) {
    return { ok: false, error: friendlyError(err) }
  }

  return { ok: true, folder: (await getFolder(userId, id)) as Folder }
}

/** Bookmarks inside survive, the foreign key's ON DELETE SET NULL unfiles them. */
export async function deleteFolder(userId: string, id: string): Promise<boolean> {
  const result = await db().execute({
    sql: "delete from folders where id = ? and user_id = ?",
    args: [id, userId]
  })
  return result.rowsAffected > 0
}

function friendlyError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (/UNIQUE constraint failed/i.test(message)) return "You already have a folder called that."
  return message
}
