/**
 * Shape of the Bento data, mirrored from website/types/db.ts so the two
 * surfaces agree without a shared build step. If you change one, change both,
 * and change website/lib/db/schema.ts with them.
 *
 * Single user, so there is no user_id column. Anything that reaches the
 * server already got past the bearer token check in the api routes.
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
