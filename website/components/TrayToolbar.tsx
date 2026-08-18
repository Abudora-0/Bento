"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { trayHref } from "~/lib/query"

export function TrayToolbar({
  initialQuery,
  topTags,
  activeTag,
  count
}: {
  initialQuery: string
  topTags: [string, number][]
  activeTag: string
  count: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(initialQuery)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep the field in step when the URL changes from somewhere else.
  useEffect(() => {
    setValue(initialQuery)
  }, [initialQuery])

  // Debounce so every keystroke is not a round trip.
  useEffect(() => {
    if (value === initialQuery) return

    const id = setTimeout(() => {
      router.replace(trayHref(searchParams, { q: value.trim() || null }), { scroll: false })
    }, 280)

    return () => clearTimeout(id)
  }, [value, initialQuery, router, searchParams])

  // Slash focuses search, the way it does in every tool worth using.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)

      if (event.key === "/" && !typing) {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const hasFilters = Boolean(
    searchParams.get("q") || searchParams.get("tag") || searchParams.get("folder") || searchParams.get("star")
  )

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <SearchIcon />
          <input
            ref={inputRef}
            type="search"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Search titles, addresses and notes"
            aria-label="Search your tray"
            className="field pl-9! font-[family-name:var(--font-body)] text-sm"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-[family-name:var(--font-mono)] text-[0.625rem] text-rice/25">
            /
          </kbd>
        </div>

        <span className="label-mono shrink-0 text-rice/35">
          {count} {count === 1 ? "piece" : "pieces"}
        </span>

        {hasFilters ? (
          <Link href="/app" className="btn-lacquer shrink-0 py-1.5! text-xs">
            Clear filters
          </Link>
        ) : null}
      </div>

      {topTags.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {topTags.map(([tag, n]) => {
            const active = tag === activeTag
            return (
              <Link
                key={tag}
                href={trayHref(searchParams, { tag: active ? null : tag })}
                aria-pressed={active}
                className={active ? "chip" : "chip-quiet hover:bg-rice/[0.12]!"}
              >
                {tag}
                <span className={active ? "ml-1.5 opacity-55" : "ml-1.5 opacity-40"}>{n}</span>
              </Link>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rice/30"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 14 14" strokeLinecap="round" />
    </svg>
  )
}
