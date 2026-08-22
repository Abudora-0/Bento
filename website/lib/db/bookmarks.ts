import type { InStatement } from "@libsql/client"

import type { Bookmark, BookmarkWithFolder, Folder } from "~/types/db"

import { db, newId, now, readBatch } from "./client.ts"
import { LIST_FOLDERS_SQL, rowToFolder } from "./folders.ts"

type Row = Record<string, unknown>

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value)
}

function nullableText(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value)
}

function rowToBookmark(row: Row): BookmarkWithFolder {
  const folderId = nullableText(row.folder_id)
  const folderName = nullableText(row.folder_name)

  return {
    id: String(row.id),
    url: String(row.url),
    title: text(row.title),
    favicon_url: nullableText(row.favicon_url),
    screenshot_url: nullableText(row.screenshot_url),
    tags: JSON.parse(text(row.tags) || "[]") as string[],
    notes: text(row.notes),
    folder_id: folderId,
    // SQLite has no boolean, the column is an integer 0 or 1.
    starred: Number(row.starred) === 1,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    folder: folderId && folderName ? { id: folderId, name: folderName } : null
  }
}

/** Escapes % and _ so a pasted search term is matched literally, not as a wildcard. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

export type SortColumn = "created_at" | "updated_at" | "title"

export type ListOptions = {
  q?: string
  tag?: string
  /** "none" for unfiled, a folder id, or undefined for no folder filter. */
  folder?: string
  starredOnly?: boolean
  sortColumn: SortColumn
  ascending: boolean
  limit: number
  offset: number
}

type SqlParam = string | number | null

/** The WHERE clause and its arguments, shared by the count and the page of rows. */
function buildFilter(userId: string, opts: ListOptions): { clause: string; args: SqlParam[] } {
  // Always first, and never optional. Everything else narrows within it.
  const where: string[] = ["bookmarks.user_id = ?"]
  const args: SqlParam[] = [userId]

  if (opts.folder === "none") {
    where.push("bookmarks.folder_id is null")
  } else if (opts.folder) {
    where.push("bookmarks.folder_id = ?")
    args.push(opts.folder)
  }

  if (opts.starredOnly) where.push("bookmarks.starred = 1")

  if (opts.tag) {
    where.push("exists (select 1 from json_each(bookmarks.tags) je where je.value = ?)")
    args.push(opts.tag)
  }

  if (opts.q) {
    where.push(
      "(bookmarks.title like ? escape '\\' or bookmarks.url like ? escape '\\' or bookmarks.notes like ? escape '\\')"
    )
    const like = `%${escapeLike(opts.q)}%`
    args.push(like, like, like)
  }

  return { clause: `where ${where.join(" and ")}`, args }
}

export type TrayData = {
  rows: BookmarkWithFolder[]
  total: number
  folders: Folder[]
  /** Every bookmark's tags, for the filter row's counts. Not paginated. */
  allTags: string[][]
}

/**
 * Everything the tray page renders, in one round trip.
 *
 * This used to be four separate calls, which cost nothing against a local file
 * and about 320ms of stacked latency against a network database. Batching them
 * is the single biggest thing keeping the page quick.
 */
export async function loadTray(userId: string, opts: ListOptions): Promise<TrayData> {
  const { clause, args } = buildFilter(userId, opts)

  // The sort column comes from lib/sort.ts's fixed enum, never straight from
  // the request, so interpolating it cannot be used for injection the way
  // interpolating a value would.
  const order = `bookmarks.${opts.sortColumn} ${opts.ascending ? "asc" : "desc"}, bookmarks.id asc`

  const statements: InStatement[] = [
    { sql: `select count(*) as n from bookmarks ${clause}`, args },
    {
      sql: `select bookmarks.*, folders.name as folder_name
            from bookmarks
            left join folders on folders.id = bookmarks.folder_id
            ${clause}
            order by ${order}
            limit ? offset ?`,
      args: [...args, opts.limit, opts.offset]
    },
    { sql: LIST_FOLDERS_SQL, args: [userId] },
    { sql: "select tags from bookmarks where user_id = ?", args: [userId] }
  ]

  const [count, page, folders, tags] = await readBatch(statements)

  return {
    total: Number((count.rows[0] as Row).n),
    rows: page.rows.map((row) => rowToBookmark(row as Row)),
    folders: folders.rows.map((row) => rowToFolder(row as Row)),
    allTags: tags.rows.map((row) => JSON.parse(text((row as Row).tags) || "[]") as string[])
  }
}

export async function getBookmark(userId: string, id: string): Promise<Bookmark | null> {
  const { rows } = await db().execute({
    sql: "select * from bookmarks where id = ? and user_id = ?",
    args: [id, userId]
  })
  return rows.length > 0 ? rowToBookmark(rows[0] as Row) : null
}

async function getBookmarkByUrl(userId: string, url: string): Promise<Row | null> {
  const { rows } = await db().execute({
    sql: "select * from bookmarks where url = ? and user_id = ?",
    args: [url, userId]
  })
  return rows.length > 0 ? (rows[0] as Row) : null
}

export type CaptureInput = {
  url: string
  title: string
  faviconUrl: string | null
  screenshotUrl: string | null
  tags: string[]
  notes: string
  folderId: string | null
}

export type UpsertResult = {
  bookmark: Bookmark
  updated: boolean
  /**
   * The screenshot the new one replaced, if any. The caller owns deleting it,
   * this layer only knows about rows.
   */
  replacedScreenshotUrl: string | null
}

/**
 * Inserts a bookmark, or merges into the existing row for that url. Re-saving
 * a page you already have unions the tags, keeps the existing note unless a
 * new one was supplied, and only moves it to a new folder if one was chosen,
 * so leaving the picker on Unfiled does not drag a filed bookmark back out.
 */
export async function upsertByUrl(userId: string, input: CaptureInput): Promise<UpsertResult> {
  const existing = await getBookmarkByUrl(userId, input.url)

  if (existing) {
    const existingTags = JSON.parse(text(existing.tags) || "[]") as string[]
    const mergedTags = [...new Set([...existingTags, ...input.tags])].slice(0, 12)
    const existingNotes = text(existing.notes)
    const notes = input.notes.trim() ? input.notes.trim() : existingNotes

    const existingShot = nullableText(existing.screenshot_url)
    const replacedScreenshotUrl =
      input.screenshotUrl && existingShot && input.screenshotUrl !== existingShot ? existingShot : null

    await db().execute({
      sql: `update bookmarks
            set title = ?, favicon_url = ?, screenshot_url = ?, tags = ?, notes = ?, folder_id = ?, updated_at = ?
            where id = ? and user_id = ?`,
      args: [
        input.title || text(existing.title),
        input.faviconUrl ?? nullableText(existing.favicon_url),
        input.screenshotUrl ?? existingShot,
        JSON.stringify(mergedTags),
        notes,
        input.folderId ?? nullableText(existing.folder_id),
        now(),
        String(existing.id),
        userId
      ]
    })

    return {
      bookmark: (await getBookmark(userId, String(existing.id))) as Bookmark,
      updated: true,
      replacedScreenshotUrl
    }
  }

  const id = newId()
  const timestamp = now()

  await db().execute({
    sql: `insert into bookmarks
            (id, user_id, url, title, favicon_url, screenshot_url, tags, notes, folder_id, starred, created_at, updated_at)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    args: [
      id,
      userId,
      input.url,
      input.title.slice(0, 500),
      input.faviconUrl,
      input.screenshotUrl,
      JSON.stringify(input.tags),
      input.notes.trim().slice(0, 10000),
      input.folderId,
      timestamp,
      timestamp
    ]
  })

  return {
    bookmark: (await getBookmark(userId, id)) as Bookmark,
    updated: false,
    replacedScreenshotUrl: null
  }
}

export type EditInput = {
  title: string
  notes: string
  tags: string[]
  folderId: string | null
}

/** The website editor. Deliberately does not touch the screenshot or favicon. */
export async function editBookmark(
  userId: string,
  id: string,
  input: EditInput
): Promise<Bookmark | null> {
  const result = await db().execute({
    sql: `update bookmarks set title = ?, notes = ?, tags = ?, folder_id = ?, updated_at = ?
          where id = ? and user_id = ?`,
    args: [input.title, input.notes, JSON.stringify(input.tags), input.folderId, now(), id, userId]
  })

  return result.rowsAffected > 0 ? getBookmark(userId, id) : null
}

export async function setStarred(userId: string, id: string, starred: boolean): Promise<boolean> {
  const result = await db().execute({
    sql: "update bookmarks set starred = ?, updated_at = ? where id = ? and user_id = ?",
    args: [starred ? 1 : 0, now(), id, userId]
  })

  return result.rowsAffected > 0
}

/** Returns the screenshot url so the caller can remove it, or null if there was none. */
export async function deleteBookmark(userId: string, id: string): Promise<string | null> {
  const { rows } = await db().execute({
    sql: "select screenshot_url from bookmarks where id = ? and user_id = ?",
    args: [id, userId]
  })

  if (rows.length === 0) return null

  await db().execute({
    sql: "delete from bookmarks where id = ? and user_id = ?",
    args: [id, userId]
  })
  return nullableText((rows[0] as Row).screenshot_url)
}

/* -------------------------------------------------------------------------- */
/* Marking up several frames at once                                           */
/* -------------------------------------------------------------------------- */

/**
 * A placeholder list for an `in (...)` clause.
 *
 * Built from the count rather than by interpolating the ids, so the ids stay
 * bound parameters. The whole reason the rest of this file is safe is that no
 * caller supplied value is ever concatenated into sql, and a bulk operation is
 * exactly where that discipline is easiest to drop.
 */
function placeholders(n: number): string {
  return Array.from({ length: n }, () => "?").join(", ")
}

/** Caps a bulk request, so one call cannot ask for an unbounded statement. */
const BULK_LIMIT = 200

function bulkIds(ids: string[]): string[] {
  return [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))].slice(0, BULK_LIMIT)
}

export async function bulkSetStarred(userId: string, ids: string[], starred: boolean): Promise<number> {
  const list = bulkIds(ids)
  if (list.length === 0) return 0

  const result = await db().execute({
    sql: `update bookmarks set starred = ?, updated_at = ? where user_id = ? and id in (${placeholders(list.length)})`,
    args: [starred ? 1 : 0, now(), userId, ...list]
  })

  return result.rowsAffected
}

export async function bulkSetFolder(userId: string, ids: string[], folderId: string | null): Promise<number> {
  const list = bulkIds(ids)
  if (list.length === 0) return 0

  const result = await db().execute({
    sql: `update bookmarks set folder_id = ?, updated_at = ? where user_id = ? and id in (${placeholders(list.length)})`,
    args: [folderId, now(), userId, ...list]
  })

  return result.rowsAffected
}

/**
 * Deletes several, and reports the screenshots that now have no row pointing at
 * them so the caller can clear them out of blob storage.
 *
 * Same split as deleteBookmark: this layer never touches storage, it only says
 * what became orphaned.
 */
export async function bulkDelete(userId: string, ids: string[]): Promise<string[]> {
  const list = bulkIds(ids)
  if (list.length === 0) return []

  const { rows } = await db().execute({
    sql: `select screenshot_url from bookmarks where user_id = ? and id in (${placeholders(list.length)})`,
    args: [userId, ...list]
  })

  await db().execute({
    sql: `delete from bookmarks where user_id = ? and id in (${placeholders(list.length)})`,
    args: [userId, ...list]
  })

  return rows
    .map((row) => nullableText((row as Row).screenshot_url))
    .filter((url): url is string => url !== null)
}

export async function countBookmarks(userId: string): Promise<number> {
  const { rows } = await db().execute({
    sql: "select count(*) as n from bookmarks where user_id = ?",
    args: [userId]
  })
  return Number((rows[0] as Row).n)
}

export async function recentBookmarks(userId: string, limit: number): Promise<Bookmark[]> {
  const { rows } = await db().execute({
    sql: "select * from bookmarks where user_id = ? order by created_at desc, id desc limit ?",
    args: [userId, limit]
  })

  return rows.map((row) => rowToBookmark(row as Row))
}
