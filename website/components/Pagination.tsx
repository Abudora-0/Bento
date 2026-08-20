"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { pageWindow } from "~/lib/pagination"
import { trayHref } from "~/lib/query"

/** The frame counter. Which stretch of the roll is on screen. */
export function Pagination({
  page,
  last,
  total,
  from,
  to
}: {
  page: number
  last: number
  total: number
  /** 1 indexed, for the "showing x to y" line. */
  from: number
  to: number
}) {
  const searchParams = useSearchParams()
  const showControls = last > 1

  function href(target: number) {
    return trayHref(searchParams, { page: target === 1 ? null : String(target) })
  }

  return (
    <nav
      aria-label="Sheet pages"
      className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3"
    >
      <p className="frame-stamp">
        {total === 0 ? "Nothing exposed" : `${pad(from)} to ${pad(to)} of ${pad(total)}`}
      </p>

      {showControls ? (
        <div className="flex items-center gap-1">
          <Step href={href(page - 1)} disabled={page <= 1} rel="prev" label="Previous page">
            <Chevron direction="left" />
          </Step>

          {pageWindow(page, last).map((n, i) =>
            n === null ? (
              <span
                key={`gap-${i}`}
                aria-hidden
                className="px-1 font-[family-name:var(--font-mono)] text-[11px] text-silver-dim"
              >
                .....
              </span>
            ) : (
              <Link
                key={n}
                href={href(n)}
                aria-label={`Page ${n}`}
                aria-current={n === page ? "page" : undefined}
                className={
                  n === page
                    ? "grid h-7 min-w-7 place-items-center px-2 font-[family-name:var(--font-head)] text-[11px] tracking-[0.14em] text-grease shadow-[inset_0_0_0_1px_rgba(204,53,44,0.5)]"
                    : "grid h-7 min-w-7 place-items-center px-2 font-[family-name:var(--font-mono)] text-[11px] text-silver-dim transition hover:bg-darkroom hover:text-print"
                }
              >
                {n}
              </Link>
            )
          )}

          <Step href={href(page + 1)} disabled={page >= last} rel="next" label="Next page">
            <Chevron direction="right" />
          </Step>
        </div>
      ) : null}
    </nav>
  )
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function Step({
  href,
  disabled,
  rel,
  label,
  children
}: {
  href: string
  disabled: boolean
  rel: "prev" | "next"
  label: string
  children: React.ReactNode
}) {
  const shape = "grid h-7 w-7 place-items-center transition"

  if (disabled) {
    return (
      <span aria-hidden className={`${shape} text-silver-dim/40`}>
        {children}
      </span>
    )
  }

  return (
    <Link
      href={href}
      rel={rel}
      aria-label={label}
      className={`${shape} text-silver-dim hover:bg-darkroom hover:text-print`}
    >
      {children}
    </Link>
  )
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <path
        d={direction === "left" ? "M10 3.5 5.5 8l4.5 4.5" : "M6 3.5 10.5 8 6 12.5"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
