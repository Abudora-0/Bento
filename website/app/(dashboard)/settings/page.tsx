import type { Metadata } from "next"
import Link from "next/link"

import { ApiTokenPanel } from "~/components/ApiTokenPanel"
import { BackfillPanel } from "~/components/BackfillPanel"
import { GetExtension } from "~/components/GetExtension"
import { ImportPanel } from "~/components/ImportPanel"
import { requireUser } from "~/lib/current-user"
import { countBookmarks, countBookmarksWithoutImage } from "~/lib/db/bookmarks"
import { isoDate } from "~/lib/format"

export const metadata: Metadata = { title: "Settings" }
export const dynamic = "force-dynamic"

/**
 * The sections, in the order they are laid out.
 *
 * Named once and used twice, for the index down the side and for the headings
 * themselves, so the two can never disagree about what is on the page or what
 * it is called.
 */
const SECTIONS = [
  { id: "account", label: "Account" },
  { id: "extension", label: "Extension" },
  { id: "import", label: "Import" },
  { id: "pictures", label: "Pictures" }
]

export default async function SettingsPage() {
  const user = await requireUser()

  /*
   * Both at once. These were two sequential awaits, which against a database
   * on the other side of the network is two stacked round trips for no reason,
   * and round trips are the cost this whole app is built around avoiding.
   */
  const [missingImages, total] = await Promise.all([
    countBookmarksWithoutImage(user.id),
    countBookmarks(user.id)
  ])

  // The Pictures panel hides itself when there is nothing to find, so its
  // heading and its entry in the index have to go with it rather than sitting
  // over an empty space.
  const sections = missingImages > 0 ? SECTIONS : SECTIONS.filter((s) => s.id !== "pictures")

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[200px_1fr] lg:items-start">
      {/*
        The page was a single 42rem column pinned to the left of a 1400px
        shell, so on a wide screen half the window was doing nothing. The index
        uses that space, and it sticks, because the panels below are long
        enough that the headings scroll away.
      */}
      <nav aria-label="Settings sections" className="hidden lg:block lg:sticky lg:top-5">
        <div className="section-rule">
          <span>On this page</span>
        </div>

        <ul className="mt-3 space-y-1">
          {sections.map((section, i) => (
            <li key={section.id}>
              {/* Same treatment the folder rail's links carry, since this is
                  the same kind of list in the same place on the page. */}
              <a
                href={`#${section.id}`}
                className="flex items-baseline gap-2 px-2.5 py-1.5 font-[family-name:var(--font-mono)] text-[11px] text-silver-dim transition hover:bg-darkroom/60 hover:text-print"
              >
                <span className="frame-stamp tabular-nums">{String(i).padStart(2, "0")}</span>
                {section.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <Link href="/app" className="ghost-btn inline-block">
            Back to the sheet
          </Link>
        </div>
      </nav>

      <main className="min-w-0 max-w-2xl">
        <Section id="account" label="Account" />

        <div className="frame mt-3">
          <div className="relative flex items-center justify-between gap-2">
            <span className="frame-no">00</span>
            <span className="frame-stamp">roll 01</span>
          </div>

          <h2 className="head-2 mt-3 break-all">{user.username}</h2>
          <p className="mt-1 break-all text-[11px] text-silver">{user.email}</p>

          {/* Something to look at rather than two lines and a paragraph, and
              both numbers are already read for the header anyway. */}
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Frames" value={String(total)} />
            <Stat label="Unexposed" value={String(missingImages)} />
            <Stat label="Since" value={isoDate(user.created_at)} />
          </dl>

          <p className="mt-4 text-[11px] leading-relaxed text-silver-dim">
            Either the name or the address signs you in, along with your password. Your sheet is
            yours alone: nobody else signed in here can see it, and you cannot see theirs.
          </p>
        </div>

        <Section id="extension" label="Extension" className="mt-8" />

        <div className="mt-3 space-y-3">
          <GetExtension />
          <ApiTokenPanel initialToken={user.api_token} />
        </div>

        <Section id="import" label="Import" className="mt-8" />

        <div className="mt-3">
          <ImportPanel />
        </div>

        {missingImages > 0 ? (
          <>
            <Section id="pictures" label="Pictures" className="mt-8" />
            <div className="mt-3">
              <BackfillPanel missing={missingImages} />
            </div>
          </>
        ) : null}

        {/* The index carries this at lg, where it is always in view. Below
            that there is no index, so the way back has to be here. */}
        <div className="mt-8 lg:hidden">
          <Link href="/app" className="ghost-btn inline-block">
            Back to the sheet
          </Link>
        </div>
      </main>
    </div>
  )
}

/** A heading the index can jump to, scrolled clear of the top of the window. */
function Section({ id, label, className = "" }: { id: string; label: string; className?: string }) {
  return (
    <div id={id} className={`section-rule scroll-mt-6 ${className}`}>
      <span>{label}</span>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="frame-stamp">{label}</dt>
      <dd className="mt-1 font-[family-name:var(--font-head)] text-[17px] leading-none text-print tabular-nums">
        {value}
      </dd>
    </div>
  )
}
