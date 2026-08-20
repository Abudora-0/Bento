import { TRAY_GRID, compartment } from "~/lib/bento-layout"
import { PAGE_SIZE } from "~/lib/pagination"

/**
 * The sheet is rendered on demand, so there is always a moment before the rows
 * arrive. Showing the frame shapes rather than a spinner means the layout does
 * not jump when the real thing lands, and the shapes come from the same cycle
 * the real grid uses so they match exactly.
 */
export default function Loading() {
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[200px_1fr] lg:items-start">
      <aside aria-hidden>
        <div className="section-rule mb-3">
          <span>The roll</span>
        </div>
        {[72, 58, 64].map((width, i) => (
          <div
            key={i}
            className="animate-developing mb-px h-7 bg-darkroom"
            style={{ width: `${width}%`, animationDelay: `${i * 120}ms` }}
          />
        ))}
      </aside>

      <main className="min-w-0">
        <div className="flex items-center gap-2" aria-hidden>
          <div className="animate-developing h-9 flex-1 bg-darkroom" />
          <div className="animate-developing h-9 w-28 bg-darkroom" />
          <div className="animate-developing h-9 w-16 bg-grease/25" />
        </div>

        <div className="section-rule mt-5">
          <span>Contact sheet</span>
        </div>

        <section className="sheet mt-3 p-3 sm:p-4" aria-busy="true" aria-label="Developing">
          <div className={TRAY_GRID}>
            {Array.from({ length: Math.min(PAGE_SIZE, 18) }, (_, index) => (
              <div
                key={index}
                className={`frame-blank animate-developing ${compartment(index).className}`}
                style={{ animationDelay: `${(index % 9) * 90}ms` }}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
