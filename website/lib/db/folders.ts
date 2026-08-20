import type { Folder } from "~/types/db"

import { db, newId, now } from "./client.ts"

export type WriteResult = { ok: true; folder: Folder } | { ok: false; error: string }

export function listFolders(): Folder[] {
  return db.prepare("select * from folders order by name collate nocase").all() as unknown as Folder[]
}

export function getFolder(id: string): Folder | null {
  return (db.prepare("select * from folders where id = ?").get(id) as Folder | undefined) ?? null
}

export function folderExists(id: string): boolean {
  return db.prepare("select 1 from folders where id = ?").get(id) !== undefined
}

export function createFolder(name: string): WriteResult {
  const id = newId()

  try {
    db.prepare("insert into folders (id, name, created_at) values (?, ?, ?)").run(id, name, now())
  } catch (err) {
    return { ok: false, error: friendlyError(err) }
  }

  return { ok: true, folder: getFolder(id) as Folder }
}

export function renameFolder(id: string, name: string): WriteResult {
  try {
    const result = db.prepare("update folders set name = ? where id = ?").run(name, id)
    if (result.changes === 0) return { ok: false, error: "That folder no longer exists." }
  } catch (err) {
    return { ok: false, error: friendlyError(err) }
  }

  return { ok: true, folder: getFolder(id) as Folder }
}

/** Bookmarks inside survive, the foreign key's ON DELETE SET NULL unfiles them. */
export function deleteFolder(id: string): boolean {
  return db.prepare("delete from folders where id = ?").run(id).changes > 0
}

function friendlyError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (message.includes("UNIQUE constraint failed")) return "You already have a folder called that."
  return message
}
