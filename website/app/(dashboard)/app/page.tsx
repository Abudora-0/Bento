import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { BookmarkCell } from "~/components/BookmarkCell"
import { FolderRail } from "~/components/FolderRail"
import { Pagination } from "~/components/Pagination"
import { TrayToolbar } from "~/components/TrayToolbar"
import { TRAY_GRID, compartment } from "~/lib/bento-layout"
import { pageRange, parsePage, totalPages } from "~/lib/pagination"
import { trayHref } from "~/lib/query"
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
  page?: string
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
  const page = parsePage(params.page)
  const [from, to] = pageRange(page)

  let query = supabase
    .from("bookmarks")
    // Exact count drives the page numbers. A personal tray is nowhere near the
    // size where counting every matching row costs anything noticeable.
    .select("*, folder:folders(id, name)", { count: "exact" })
    .eq("user_id", user.id)
    .order(order.column, { ascending: order.ascending })
    // A stable tiebreak, otherwise rows with an equal sort key can swap places
    // between pages and you get one twice while never seeing another.
    .order("id", { ascending: true })
    .range(from, to)

  if (folder === "none") query = query.is("folder_id", null)
  else if (folder) query = query.eq("folder_id", folder)

  if (tag) query = query.contains("tags", [tag])
  if (starredOnly) query = query.eq("starred", true)
  if (q) query = query.or(`title.ilike.%${q}%,url.ilike.%${q}%,notes.ilike.%${q}%`)

  const [{ data: bookmarks, error: bookmarksError, count }, { data: folders }, { data: tagRows }] =
    await Promise.all([
      query,
      supabase.from("folders").select("*").eq("user_id", user.id).order("name"),
      supabase.from("bookmarks").select("tags").eq("user_id", user.id).limit(2000)
    ])

  const allFolders = (folders ?? []) as Folder[]
  const rows = (bookmarks ?? []) as unknown as BookmarkWithFolder[]

  const total = count ?? 0
  const lastPage = totalPages(total)

  // Deleting the last few rows, or arriving on a bookmarked deep link, can put
  // you past the end. Send them to the final page rather than an empty tray.
  if (page > lastPage && total > 0) {
    const carried = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value !== "") carried.set(key, value)
    }

    redirect(trayHref(carried, { page: lastPage === 1 ? null : String(lastPage) }))
  }

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
          count={total}
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
                    frame={from + index + 1}
                  />
                )
              })}
            </div>
          )}
        </section>

        <Pagination
          page={page}
          last={lastPage}
          total={total}
          from={total === 0 ? 0 : from + 1}
          to={from + rows.length}
        />
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
