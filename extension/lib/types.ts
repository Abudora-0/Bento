/**
 * Shape of the Bento tables, mirrored from website/types/db.ts so the two
 * surfaces agree without a shared build step. If you change one, change both,
 * and change website/lib/db/schema.ts with them.
 *
 * The tables carry a user_id, and these types deliberately do not. A row is
 * only ever loaded for whoever asked for it, so passing the owner back out to
 * the client would be telling it something it has no use for and cannot check.
 * The api routes strip it, which is why the extension never has to know
 * accounts exist at all.
 */

export type Folder = {
  id: string
  name: string
  created_at: string
}

export type Bookmark = {
  id: string
  url: string
  title: string
  favicon_url: string | null
  screenshot_url: string | null
  tags: string[]
  notes: string
  folder_id: string | null
  starred: boolean
  created_at: string
  updated_at: string
}

/** A bookmark joined with the folder it sits in, which is what the grid renders. */
export type BookmarkWithFolder = Bookmark & {
  folder: Pick<Folder, "id" | "name"> | null
}
