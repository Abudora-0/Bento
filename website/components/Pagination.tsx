"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { pageWindow } from "~/lib/pagination"
import { trayHref } from "~/lib/query"

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

  // Page one of one is not worth a control, but the count still is.
  const showControls = last > 1

  function href(target: number) {
    return trayHref(searchParams, { page: target === 1 ? null : String(target) })
  }

  return (
    <nav
      aria-label="Tray pages"
      className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3"
    >
      <p className="label-mono text-rice/35">
        {total === 0 ? "Nothing to show" : `${from} to ${to} of ${total}`}
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
                className="px-1 font-[family-name:var(--font-mono)] text-xs text-rice/25"
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
                    ? "grid h-7 min-w-7 place-items-center rounded-full bg-oxblood-lit px-2 font-[family-name:var(--font-mono)] text-xs text-rice shadow-[inset_0_0_0_1px_rgba(224,196,131,0.55)]"
                    : "grid h-7 min-w-7 place-items-center rounded-full px-2 font-[family-name:var(--font-mono)] text-xs text-rice/50 transition hover:bg-rice/[0.06] hover:text-rice"
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
  const shape = "grid h-7 w-7 place-items-center rounded-full transition"

  if (disabled) {
    return (
      <span aria-hidden className={`${shape} text-rice/15`}>
        {children}
      </span>
    )
  }

  return (
    <Link
      href={href}
      rel={rel}
      aria-label={label}
      className={`${shape} text-rice/55 hover:bg-rice/[0.06] hover:text-rice`}
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
