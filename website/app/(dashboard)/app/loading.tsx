import { TRAY_GRID, compartment } from "~/lib/bento-layout"
import { PAGE_SIZE } from "~/lib/pagination"

/**
 * The tray is rendered on demand, so there is always a moment before the rows
 * arrive. Showing the compartment shapes rather than a spinner means the layout
 * does not jump when the real thing lands.
 */
export default function Loading() {
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[218px_1fr] lg:items-start">
      <aside className="space-y-2" aria-hidden>
        {[72, 58, 64].map((width, i) => (
          <div key={i} className="h-8 animate-pulse rounded-lg bg-rice/[0.05]" style={{ width: `${width}%` }} />
        ))}
        <div className="seam my-4" />
        {[52, 68, 44].map((width, i) => (
          <div key={i} className="h-7 animate-pulse rounded-lg bg-rice/[0.04]" style={{ width: `${width}%` }} />
        ))}
      </aside>

      <main className="min-w-0">
        <div className="flex items-center gap-2.5" aria-hidden>
          <div className="h-9 flex-1 animate-pulse rounded-lg bg-rice/[0.05]" />
          <div className="h-8 w-28 animate-pulse rounded-lg bg-rice/[0.04]" />
          <div className="h-8 w-16 animate-pulse rounded-full bg-oxblood/30" />
        </div>

        <section className="tray mt-5 p-3 sm:p-5" aria-busy="true" aria-label="Loading your tray">
          <div className={`relative ${TRAY_GRID}`}>
            {Array.from({ length: Math.min(PAGE_SIZE, 18) }, (_, index) => (
              <div
                key={index}
                className={`cell-empty animate-pulse ${compartment(index).className}`}
                style={{ animationDelay: `${(index % 9) * 70}ms` }}
              />
            ))}
          </div>
        </section>

        <div className="mt-5 h-7 w-40 animate-pulse rounded-full bg-rice/[0.04]" aria-hidden />
      </main>
    </div>
  )
}
