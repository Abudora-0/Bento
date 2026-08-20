import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { BookmarkCell } from "~/components/BookmarkCell"
import { FolderRail } from "~/components/FolderRail"
import { Pagination } from "~/components/Pagination"
import { TrayToolbar } from "~/components/TrayToolbar"
import { TRAY_GRID, compartment } from "~/lib/bento-layout"
import { listAllTags, listBookmarks } from "~/lib/db/bookmarks"
import { listFolders } from "~/lib/db/folders"
import { PAGE_SIZE, pageOffset, parsePage, totalPages } from "~/lib/pagination"
import { trayHref } from "~/lib/query"
import { parseSort, sortOption } from "~/lib/sort"

export const metadata: Metadata = { title: "The sheet" }
export const dynamic = "force-dynamic"

type SearchParams = Promise<{
  q?: string
  tag?: string
  folder?: string
  star?: string
  sort?: string
  page?: string
}>

export default async function TrayPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams

  const q = (params.q ?? "").trim().slice(0, 120)
  const tag = (params.tag ?? "").trim().slice(0, 32)
  const folder = (params.folder ?? "").trim()
  const starredOnly = params.star === "1"
  const sort = parseSort(params.sort)
  const order = sortOption(sort)
  const page = parsePage(params.page)
  const from = pageOffset(page)

  const { rows, total } = listBookmarks({
    q: q || undefined,
    tag: tag || undefined,
    folder: folder || undefined,
    starredOnly,
    sortColumn: order.column,
    ascending: order.ascending,
    limit: PAGE_SIZE,
    offset: from
  })

  const allFolders = listFolders()
  const lastPage = totalPages(total)

  // Deleting the last few rows, or arriving on a bookmarked deep link, can put
  // you past the end. Send them to the final page rather than an empty sheet.
  if (page > lastPage && total > 0) {
    const carried = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value !== "") carried.set(key, value)
    }

    redirect(trayHref(carried, { page: lastPage === 1 ? null : String(lastPage) }))
  }

  // Tag counts across the whole roll, so the filter row does not shrink as you filter.
  const tagCounts = new Map<string, number>()
  for (const bookmarkTags of listAllTags()) {
    for (const t of bookmarkTags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 24)

  const filtering = Boolean(q || tag || folder || starredOnly)

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[200px_1fr] lg:items-start">
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

        <div className="section-rule mt-5">
          <span>Contact sheet</span>
        </div>

        <section className="sheet mt-3 p-3 sm:p-4">
          {rows.length === 0 ? (
            <EmptySheet filtering={filtering} />
          ) : (
            // Keyed by page so the whole grid re-runs its advance animation
            // when you turn to the next one, like film moving on.
            <div key={page} className={`animate-advance ${TRAY_GRID}`}>
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
                    index={index}
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

function EmptySheet({ filtering }: { filtering: boolean }) {
  return (
    <div className="flex min-h-[340px] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="grid grid-cols-3 gap-2" aria-hidden>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="frame-blank h-12 w-20" style={{ opacity: 0.35 + (i % 3) * 0.2 }} />
        ))}
      </div>

      <h2 className="head-2 mt-8">{filtering ? "Nothing on this frame" : "Unexposed"}</h2>

      <p className="mt-3 max-w-sm text-[11px] leading-relaxed text-silver-dim">
        {filtering
          ? "No saved page matches those filters. Clear them to see the whole roll again."
          : "Press Add to expose one by hand, or pin the Bento extension to your toolbar and capture the page you are on."}
      </p>
    </div>
  )
}
