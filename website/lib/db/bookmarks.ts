import type { Bookmark, BookmarkWithFolder } from "~/types/db"

import { db, newId, now } from "./client.ts"

type BookmarkRow = {
  id: string
  url: string
  title: string
  favicon_url: string | null
  screenshot_url: string | null
  tags: string
  notes: string
  folder_id: string | null
  starred: number
  created_at: string
  updated_at: string
  folder_name?: string | null
}

function rowToBookmark(row: BookmarkRow): BookmarkWithFolder {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    favicon_url: row.favicon_url,
    screenshot_url: row.screenshot_url,
    tags: JSON.parse(row.tags) as string[],
    notes: row.notes,
    folder_id: row.folder_id,
    starred: row.starred === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
    folder: row.folder_id && row.folder_name ? { id: row.folder_id, name: row.folder_name } : null
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

export function listBookmarks(opts: ListOptions): { rows: BookmarkWithFolder[]; total: number } {
  const where: string[] = []
  const params: SqlParam[] = []

  if (opts.folder === "none") {
    where.push("bookmarks.folder_id is null")
  } else if (opts.folder) {
    where.push("bookmarks.folder_id = ?")
    params.push(opts.folder)
  }

  if (opts.starredOnly) where.push("bookmarks.starred = 1")

  if (opts.tag) {
    where.push("exists (select 1 from json_each(bookmarks.tags) je where je.value = ?)")
    params.push(opts.tag)
  }

  if (opts.q) {
    where.push(
      "(bookmarks.title like ? escape '\\' or bookmarks.url like ? escape '\\' or bookmarks.notes like ? escape '\\')"
    )
    const like = `%${escapeLike(opts.q)}%`
    params.push(like, like, like)
  }

  const clause = where.length ? `where ${where.join(" and ")}` : ""

  const total = (
    db.prepare(`select count(*) as n from bookmarks ${clause}`).get(...params) as { n: number }
  ).n

  // Sort column comes from lib/sort.ts's fixed enum, never straight from the
  // request, so interpolating it here does not open a column name up to
  // injection the way interpolating a value would.
  const order = `bookmarks.${opts.sortColumn} ${opts.ascending ? "asc" : "desc"}, bookmarks.id asc`

  const rows = db
    .prepare(
      `select bookmarks.*, folders.name as folder_name
       from bookmarks
       left join folders on folders.id = bookmarks.folder_id
       ${clause}
       order by ${order}
       limit ? offset ?`
    )
    .all(...params, opts.limit, opts.offset) as unknown as BookmarkRow[]

  return { rows: rows.map(rowToBookmark), total }
}

/** Every tag on every bookmark, for the filter rail's counts. Not paginated. */
export function listAllTags(): string[][] {
  const rows = db.prepare("select tags from bookmarks").all() as { tags: string }[]
  return rows.map((row) => JSON.parse(row.tags) as string[])
}

export function getBookmark(id: string): Bookmark | null {
  const row = db.prepare("select * from bookmarks where id = ?").get(id) as BookmarkRow | undefined
  return row ? rowToBookmark(row) : null
}

function getBookmarkByUrl(url: string): BookmarkRow | undefined {
  return db.prepare("select * from bookmarks where url = ?").get(url) as BookmarkRow | undefined
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

/**
 * Inserts a bookmark, or merges into the existing row for that url. Re-saving
 * a page you already have unions the tags, keeps the existing note unless a
 * new one was supplied, and only moves it to a new folder if one was chosen,
 * so leaving the picker on Unfiled does not drag a filed bookmark back out.
 */
export function upsertByUrl(input: CaptureInput): { bookmark: Bookmark; updated: boolean } {
  const existing = getBookmarkByUrl(input.url)

  if (existing) {
    const mergedTags = [...new Set([...(JSON.parse(existing.tags) as string[]), ...input.tags])].slice(0, 12)
    const notes = input.notes.trim() ? input.notes.trim() : existing.notes

    db.prepare(
      `update bookmarks
       set title = ?, favicon_url = ?, screenshot_url = ?, tags = ?, notes = ?, folder_id = ?, updated_at = ?
       where id = ?`
    ).run(
      input.title || existing.title,
      input.faviconUrl ?? existing.favicon_url,
      input.screenshotUrl ?? existing.screenshot_url,
      JSON.stringify(mergedTags),
      notes,
      input.folderId ?? existing.folder_id,
      now(),
      existing.id
    )

    return { bookmark: getBookmark(existing.id) as Bookmark, updated: true }
  }

  const id = newId()
  const timestamp = now()

  db.prepare(
    `insert into bookmarks
       (id, url, title, favicon_url, screenshot_url, tags, notes, folder_id, starred, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(
    id,
    input.url,
    input.title.slice(0, 500),
    input.faviconUrl,
    input.screenshotUrl,
    JSON.stringify(input.tags),
    input.notes.trim().slice(0, 10000),
    input.folderId,
    timestamp,
    timestamp
  )

  return { bookmark: getBookmark(id) as Bookmark, updated: false }
}

export type EditInput = {
  title: string
  notes: string
  tags: string[]
  folderId: string | null
}

/** The website editor. Deliberately does not touch the screenshot or favicon. */
export function editBookmark(id: string, input: EditInput): Bookmark | null {
  const result = db
    .prepare(
      "update bookmarks set title = ?, notes = ?, tags = ?, folder_id = ?, updated_at = ? where id = ?"
    )
    .run(input.title, input.notes, JSON.stringify(input.tags), input.folderId, now(), id)

  return result.changes > 0 ? getBookmark(id) : null
}

export function setStarred(id: string, starred: boolean): boolean {
  return (
    db.prepare("update bookmarks set starred = ?, updated_at = ? where id = ?").run(starred ? 1 : 0, now(), id)
      .changes > 0
  )
}

/** Returns the screenshot url so the caller can remove the file, or null if there was none. */
export function deleteBookmark(id: string): string | null {
  const row = db.prepare("select screenshot_url from bookmarks where id = ?").get(id) as
    | { screenshot_url: string | null }
    | undefined

  if (!row) return null

  db.prepare("delete from bookmarks where id = ?").run(id)
  return row.screenshot_url
}

export function countBookmarks(): number {
  return (db.prepare("select count(*) as n from bookmarks").get() as { n: number }).n
}

export function recentBookmarks(limit: number): Bookmark[] {
  const rows = db
    .prepare("select * from bookmarks order by created_at desc, id desc limit ?")
    .all(limit) as unknown as BookmarkRow[]

  return rows.map(rowToBookmark)
}
