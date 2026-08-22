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

export const LIST_FOLDERS_SQL = "select * from folders order by name collate nocase"

export async function listFolders(): Promise<Folder[]> {
  const { rows } = await db().execute(LIST_FOLDERS_SQL)
  return rows.map((row) => rowToFolder(row as Row))
}

export async function getFolder(id: string): Promise<Folder | null> {
  const { rows } = await db().execute({ sql: "select * from folders where id = ?", args: [id] })
  return rows.length > 0 ? rowToFolder(rows[0] as Row) : null
}

export async function folderExists(id: string): Promise<boolean> {
  const { rows } = await db().execute({ sql: "select 1 from folders where id = ?", args: [id] })
  return rows.length > 0
}

export async function createFolder(name: string): Promise<WriteResult> {
  const id = newId()

  try {
    await db().execute({
      sql: "insert into folders (id, name, created_at) values (?, ?, ?)",
      args: [id, name, now()]
    })
  } catch (err) {
    return { ok: false, error: friendlyError(err) }
  }

  return { ok: true, folder: (await getFolder(id)) as Folder }
}

export async function renameFolder(id: string, name: string): Promise<WriteResult> {
  try {
    const result = await db().execute({
      sql: "update folders set name = ? where id = ?",
      args: [name, id]
    })
    if (result.rowsAffected === 0) return { ok: false, error: "That folder no longer exists." }
  } catch (err) {
    return { ok: false, error: friendlyError(err) }
  }

  return { ok: true, folder: (await getFolder(id)) as Folder }
}

/** Bookmarks inside survive, the foreign key's ON DELETE SET NULL unfiles them. */
export async function deleteFolder(id: string): Promise<boolean> {
  const result = await db().execute({ sql: "delete from folders where id = ?", args: [id] })
  return result.rowsAffected > 0
}

function friendlyError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (/UNIQUE constraint failed/i.test(message)) return "You already have a folder called that."
  return message
}
