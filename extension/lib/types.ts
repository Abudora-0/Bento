/**
 * Shape of the Bento tables, mirrored from website/types/db.ts so the two
 * surfaces agree without a shared build step. If you change one, change both,
 * and change supabase/migrations with them.
 */

export type Folder = {
  id: string
  user_id: string
  name: string
  created_at: string
}

export type Bookmark = {
  id: string
  user_id: string
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

export type BookmarkInsert = Omit<Bookmark, "id" | "created_at" | "updated_at"> & {
  id?: string
  created_at?: string
  updated_at?: string
}

export type Database = {
  public: {
    Tables: {
      folders: {
        Row: Folder
        Insert: Omit<Folder, "id" | "created_at"> & { id?: string; created_at?: string }
        Update: Partial<Omit<Folder, "id" | "user_id">>
        Relationships: []
      }
      bookmarks: {
        Row: Bookmark
        Insert: BookmarkInsert
        Update: Partial<Omit<Bookmark, "id" | "user_id" | "created_at">>
        Relationships: [
          {
            foreignKeyName: "bookmarks_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

/** A bookmark joined with the folder it sits in, which is what the grid renders. */
export type BookmarkWithFolder = Bookmark & {
  folder: Pick<Folder, "id" | "name"> | null
}
