"use client"

import { useState, useTransition } from "react"

import { setStarred } from "~/app/(dashboard)/actions"
import { hostnameOf, isoDate } from "~/lib/format"
import type { BookmarkWithFolder, Folder } from "~/types/db"

import { BookmarkEditor } from "./BookmarkEditor"

export function BookmarkCell({
  bookmark,
  folders,
  className,
  tall,
  wide,
  frame
}: {
  bookmark: BookmarkWithFolder
  folders: Folder[]
  className: string
  tall: boolean
  wide: boolean
  frame: number
}) {
  const [editing, setEditing] = useState(false)
  const [starred, setLocalStarred] = useState(bookmark.starred)
  const [, startTransition] = useTransition()

  const host = hostnameOf(bookmark.url)
  const title = bookmark.title?.trim() || host
  const showShot = tall && Boolean(bookmark.screenshot_url)
  const visibleTags = bookmark.tags.slice(0, wide ? 4 : 2)
  const hiddenTags = bookmark.tags.length - visibleTags.length

  function toggleStar() {
    const next = !starred
    setLocalStarred(next)
    startTransition(async () => {
      const result = await setStarred(bookmark.id, next)
      if (!result.ok) setLocalStarred(!next)
    })
  }

  return (
    <>
      <article className={`cell group/cell overflow-hidden ${className}`}>
        {/* The whole compartment opens the page. Controls sit above this layer. */}
        <a
          href={bookmark.url}
          target="_blank"
          rel="noreferrer noopener"
          className="absolute inset-0 z-10"
        >
          <span className="sr-only">Open {title}</span>
        </a>

        {showShot ? (
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bookmark.screenshot_url as string}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover object-top opacity-[0.22] saturate-[0.6]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-rice via-rice/85 to-rice/40" />
          </div>
        ) : null}

        <div className="relative flex h-full flex-col justify-between gap-2 p-3 sm:p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <Favicon src={bookmark.favicon_url} host={host} />
              <span className="truncate font-[family-name:var(--font-mono)] text-[0.6875rem] tracking-tight text-ink-soft">
                {host}
              </span>
            </div>

            <button
              type="button"
              onClick={toggleStar}
              aria-pressed={starred}
              aria-label={starred ? "Remove star" : "Star this"}
              title={starred ? "Remove star" : "Star this"}
              className={`relative z-20 -m-1 shrink-0 rounded-full p-1 transition ${
                starred ? "opacity-100" : "opacity-0 group-hover/cell:opacity-100 focus-visible:opacity-100"
              }`}
            >
              <Seal filled={starred} />
            </button>
          </div>

          <div className="min-w-0">
            <h3
              className={`font-[family-name:var(--font-display)] font-medium leading-snug text-ink ${
                tall ? "text-[1.0625rem] clamp-3" : "text-sm clamp-2"
              }`}
            >
              {title}
            </h3>

            {wide && bookmark.notes ? (
              <p className="mt-1 clamp-2 text-[0.8125rem] leading-snug text-ink-soft/85">
                {bookmark.notes}
              </p>
            ) : null}
          </div>

          <div className="flex items-end justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              {visibleTags.map((tag) => (
                <span key={tag} className="chip">
                  {tag}
                </span>
              ))}
              {hiddenTags > 0 ? (
                <span className="font-[family-name:var(--font-mono)] text-[0.625rem] text-ink-soft/70">
                  +{hiddenTags}
                </span>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {bookmark.folder ? (
                <span className="hidden truncate font-[family-name:var(--font-mono)] text-[0.625rem] text-ink-soft/70 sm:inline">
                  {bookmark.folder.name}
                </span>
              ) : null}

              <span className="font-[family-name:var(--font-mono)] text-[0.625rem] text-ink-soft/55">
                {isoDate(bookmark.created_at)}
              </span>

              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label={`Edit ${title}`}
                title="Edit"
                className="relative z-20 -m-1 rounded p-1 text-ink-soft/50 opacity-0 transition hover:text-oxblood focus-visible:opacity-100 group-hover/cell:opacity-100"
              >
                <PencilIcon />
              </button>
            </div>
          </div>
        </div>

        {/* Compartment number, stamped into the lacquer at the corner. */}
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 select-none font-[family-name:var(--font-mono)] text-[3.25rem] leading-none text-ink/[0.04]"
        >
          {String(frame).padStart(2, "0")}
        </span>
      </article>

      {editing ? (
        <BookmarkEditor bookmark={bookmark} folders={folders} onClose={() => setEditing(false)} />
      ) : null}
    </>
  )
}

function Favicon({ src, host }: { src: string | null; host: string }) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <span
        aria-hidden
        className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] bg-oxblood/85 font-[family-name:var(--font-display)] text-[0.5rem] text-rice"
      >
        {host.charAt(0).toUpperCase() || "?"}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={14}
      height={14}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-3.5 w-3.5 shrink-0 rounded-[3px] object-contain"
    />
  )
}

/** A vermilion hanko seal. The website equivalent of the popup grease pencil. */
function Seal({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
      <circle
        cx="10"
        cy="10"
        r="8.4"
        fill={filled ? "#7e2024" : "none"}
        stroke={filled ? "#5b1519" : "#5f5049"}
        strokeWidth="1.4"
        opacity={filled ? 1 : 0.55}
      />
      {filled ? (
        <path
          d="M10 5.4 11.4 8.7l3.5.3-2.7 2.3.8 3.4L10 12.9l-3 1.8.8-3.4L5.1 9l3.5-.3z"
          fill="#f3e9d6"
        />
      ) : null}
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M11.2 2.5 13.5 4.8 5.6 12.7l-3 .7.7-3z" strokeLinejoin="round" />
    </svg>
  )
}
