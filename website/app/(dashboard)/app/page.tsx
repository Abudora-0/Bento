import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { cache } from "react"

import { FolderRail } from "~/components/FolderRail"
import { GetExtension } from "~/components/GetExtension"
import { Pagination } from "~/components/Pagination"
import { Sheet } from "~/components/Sheet"
import { TrayToolbar } from "~/components/TrayToolbar"
import { currentUser, requireUser } from "~/lib/current-user"
import { loadTray } from "~/lib/db/bookmarks"
import { PAGE_SIZE, pageOffset, parsePage, totalPages } from "~/lib/pagination"
import { trayHref } from "~/lib/query"
import { parseSort, sortOption, type SortKey } from "~/lib/sort"

export const dynamic = "force-dynamic"

type SearchParams = Promise<{
  q?: string
  tag?: string
  folder?: string
  star?: string
  sort?: string
  page?: string
}>

type Params = Awaited<SearchParams>

/** One place that turns the url into the arguments loadTray wants. */
function readParams(params: Params) {
  const q = (params.q ?? "").trim().slice(0, 120)
  const tag = (params.tag ?? "").trim().slice(0, 32)
  const folder = (params.folder ?? "").trim()
  const starredOnly = params.star === "1"
  const sort = parseSort(params.sort)
  const page = parsePage(params.page)

  return { q, tag, folder, starredOnly, sort, page, from: pageOffset(page) }
}

/**
 * The tray read, memoised for the length of one request.
 *
 * generateMetadata and the page component both need it, and Next runs them as
 * two separate calls. Without React's cache that would be two trips to the
 * database for the same rows, which on a network SQLite is the one cost this
 * whole app is built around avoiding: loadTray exists specifically to collapse
 * four reads into one round trip, and an uncached second call would hand that
 * saving straight back.
 */
const readTray = cache(
  async (
    userId: string,
    q: string,
    tag: string,
    folder: string,
    starredOnly: boolean,
    sort: SortKey,
    from: number
  ) => {
    const order = sortOption(sort)

    return loadTray(userId, {
      q: q || undefined,
      tag: tag || undefined,
      folder: folder || undefined,
      starredOnly,
      sortColumn: order.column,
      ascending: order.ascending,
      limit: PAGE_SIZE,
      offset: from
    })
  }
)

/**
 * Spread into readTray, so both callers pass identical primitives.
 *
 * React's cache compares arguments by reference. searchParams is awaited
 * separately in generateMetadata and in the component, so those are two
 * different objects and passing one straight through would miss the cache on
 * every single request while looking exactly like it was working.
 */
function trayArgs(params: Params): [string, string, string, boolean, SortKey, number] {
  const { q, tag, folder, starredOnly, sort, from } = readParams(params)
  return [q, tag, folder, starredOnly, sort, from]
}

/**
 * The tab title says what you are looking at.
 *
 * With several sheets open, "The sheet" on all of them is useless. A count and
 * the active filter make each tab findable without switching to it.
 */
export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const params = await searchParams
  const user = await currentUser()
  if (!user) return { title: "The sheet" }

  const { q, tag, folder, starredOnly, page } = readParams(params)

  let total: number
  let folders: { id: string; name: string }[]
  try {
    const tray = await readTray(user.id, ...trayArgs(params))
    total = tray.total
    folders = tray.folders
  } catch {
    // A title is not worth failing a page render over.
    return { title: "The sheet" }
  }

  const what = `${total} ${total === 1 ? "frame" : "frames"}`

  let scope = ""
  if (q) scope = `"${q}"`
  else if (tag) scope = `#${tag}`
  else if (starredOnly) scope = "Marked"
  else if (folder === "none") scope = "Unfiled"
  else if (folder) scope = folders.find((f) => f.id === folder)?.name ?? "Folder"

  const suffix = page > 1 ? `, page ${page}` : ""

  return { title: scope ? `${scope}, ${what}${suffix}` : `${what}${suffix}` }
}

export default async function TrayPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const user = await requireUser()

  const { q, tag, folder, starredOnly, sort, page, from } = readParams(params)

  // Memoised, so generateMetadata's call above and this one are one round trip.
  const { rows, total, folders: allFolders, allTags } = await readTray(user.id, ...trayArgs(params))

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
  for (const bookmarkTags of allTags) {
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
            // Sheet owns the cursor, the selection and the loupe, and keys
            // the grid by page so the advance animation re-runs on each turn.
            <Sheet rows={rows} folders={allFolders} from={from} page={page} />
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
          : "Press Add to expose one by hand, or put the extension on your toolbar and capture whatever page you are looking at."}
      </p>

      {filtering ? null : <GetExtension compact />}
    </div>
  )
}
