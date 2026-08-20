"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { trayHref } from "~/lib/query"
import { SORT_OPTIONS, type SortKey } from "~/lib/sort"
import type { Folder } from "~/types/db"

import { AddBookmarkDialog } from "./AddBookmarkDialog"

export function TrayToolbar({
  initialQuery,
  topTags,
  activeTag,
  count,
  sort,
  folders,
  activeFolder
}: {
  initialQuery: string
  topTags: [string, number][]
  activeTag: string
  count: number
  sort: SortKey
  folders: Folder[]
  activeFolder: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(initialQuery)
  const [adding, setAdding] = useState(false)
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
    searchParams.get("q") ||
      searchParams.get("tag") ||
      searchParams.get("folder") ||
      searchParams.get("star")
  )

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <SearchIcon />
          <input
            ref={inputRef}
            type="search"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Search titles, addresses and notes"
            aria-label="Search your tray"
            className="field pl-9!"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-[family-name:var(--font-mono)] text-[10px] text-silver-dim">
            /
          </kbd>
        </div>

        <label className="sr-only" htmlFor="tray-sort">
          Order the sheet
        </label>
        <select
          id="tray-sort"
          value={sort}
          onChange={(e) => {
            const next = e.target.value as SortKey
            router.replace(trayHref(searchParams, { sort: next === "new" ? null : next }), {
              scroll: false
            })
          }}
          className="field w-auto shrink-0 cursor-pointer py-2! text-[11px]"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>

        <button type="button" onClick={() => setAdding(true)} className="shrink-0 shutter">
          Add
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 frame-stamp">
          {count} {count === 1 ? "frame" : "frames"}
        </span>

        {topTags.map(([tag, n]) => {
          const active = tag === activeTag
          return (
            <Link
              key={tag}
              href={trayHref(searchParams, { tag: active ? null : tag })}
              aria-pressed={active}
              className={active ? "tag tag-on" : "tag"}
            >
              {tag}
              <span className="ml-1.5 opacity-55">{n}</span>
            </Link>
          )
        })}

        {hasFilters ? (
          <Link href="/app" className="ml-1 ghost text-grease hover:text-grease-lit">
            Clear
          </Link>
        ) : null}
      </div>

      {adding ? (
        <AddBookmarkDialog
          folders={folders}
          // Adding while a folder is open files it there, which is what you meant.
          defaultFolderId={activeFolder && activeFolder !== "none" ? activeFolder : null}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-silver-dim"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 14 14" strokeLinecap="round" />
    </svg>
  )
}
