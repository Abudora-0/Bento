import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { BookmarkCell } from "~/components/BookmarkCell"
import { FolderRail } from "~/components/FolderRail"
import { TrayToolbar } from "~/components/TrayToolbar"
import { TRAY_GRID, compartment } from "~/lib/bento-layout"
import { parseSort, sortOption } from "~/lib/sort"
import { createClient } from "~/lib/supabase/server"
import type { BookmarkWithFolder, Folder } from "~/types/db"

export const metadata: Metadata = { title: "Your tray" }
export const dynamic = "force-dynamic"

type SearchParams = Promise<{
  q?: string
  tag?: string
  folder?: string
  star?: string
  sort?: string
}>

/** PostgREST reads commas and parentheses as syntax inside an or() filter. */
function sanitizeSearch(input: string): string {
  return input.replace(/[,()%\\*]/g, " ").trim().slice(0, 120)
}

export default async function TrayPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const supabase = await createClient()

  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const q = sanitizeSearch(params.q ?? "")
  const tag = (params.tag ?? "").trim().slice(0, 32)
  const folder = (params.folder ?? "").trim()
  const starredOnly = params.star === "1"
  const sort = parseSort(params.sort)
  const order = sortOption(sort)

  let query = supabase
    .from("bookmarks")
    .select("*, folder:folders(id, name)")
    .eq("user_id", user.id)
    .order(order.column, { ascending: order.ascending })
    .limit(500)

  if (folder === "none") query = query.is("folder_id", null)
  else if (folder) query = query.eq("folder_id", folder)

  if (tag) query = query.contains("tags", [tag])
  if (starredOnly) query = query.eq("starred", true)
  if (q) query = query.or(`title.ilike.%${q}%,url.ilike.%${q}%,notes.ilike.%${q}%`)

  const [{ data: bookmarks, error: bookmarksError }, { data: folders }, { data: tagRows }] =
    await Promise.all([
      query,
      supabase.from("folders").select("*").eq("user_id", user.id).order("name"),
      supabase.from("bookmarks").select("tags").eq("user_id", user.id).limit(2000)
    ])

  const allFolders = (folders ?? []) as Folder[]
  const rows = (bookmarks ?? []) as unknown as BookmarkWithFolder[]

  // Tag counts across the whole tray, so the filter rail does not shrink as you filter.
  const tagCounts = new Map<string, number>()
  for (const row of tagRows ?? []) {
    for (const t of row.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 24)

  const filtering = Boolean(q || tag || folder || starredOnly)

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[218px_1fr] lg:items-start">
      <FolderRail folders={allFolders} activeFolder={folder} starredOnly={starredOnly} />

      <main className="min-w-0">
        <TrayToolbar
          initialQuery={params.q ?? ""}
          topTags={topTags}
          activeTag={tag}
          count={rows.length}
          sort={sort}
          folders={allFolders}
          activeFolder={folder}
        />

        {bookmarksError ? (
          <p
            role="alert"
            className="mt-6 rounded-xl bg-oxblood/30 px-4 py-3 text-sm text-rice shadow-[inset_0_0_0_1px_rgba(201,162,74,0.35)]"
          >
            Could not load the tray: {bookmarksError.message}
          </p>
        ) : null}

        <section className="tray mt-5 p-3 sm:p-5">
          {rows.length === 0 ? (
            <EmptyTray filtering={filtering} />
          ) : (
            <div className={`relative ${TRAY_GRID}`}>
              {rows.map((bookmark, index) => {
                const shape = compartment(index)
                return (
                  <BookmarkCell
                    key={bookmark.id}
                    bookmark={bookmark}
                    folders={allFolders}
                    className={shape.className}
                    tall={shape.tall}
                    wide={shape.wide}
                    frame={index + 1}
                  />
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function EmptyTray({ filtering }: { filtering: boolean }) {
  return (
    <div className="relative flex min-h-[340px] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="grid grid-cols-3 gap-2.5" aria-hidden>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="cell-empty h-11 w-16"
            style={{ opacity: 0.35 + (i % 3) * 0.18 }}
          />
        ))}
      </div>

      <h2 className="mt-8 font-[family-name:var(--font-display)] text-2xl text-rice">
        {filtering ? "Nothing in this compartment" : "The tray is empty"}
      </h2>

      <p className="mt-3 max-w-sm text-sm leading-relaxed text-rice/55">
        {filtering
          ? "No saved page matches those filters. Clear them to see the whole tray again."
          : "Press Add to put one in by hand, or pin the Bento extension to your toolbar and capture the page you are on."}
      </p>
    </div>
  )
}
