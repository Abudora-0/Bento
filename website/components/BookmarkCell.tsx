"use client"

import { useState, useTransition } from "react"

import { setStarred } from "~/app/(dashboard)/actions"
import { hostnameOf, isoDate } from "~/lib/format"
import type { BookmarkWithFolder, Folder } from "~/types/db"

import { BookmarkEditor } from "./BookmarkEditor"
import { GreaseCircle } from "./Wordmark"

export function BookmarkCell({
  bookmark,
  folders,
  className,
  tall,
  wide,
  frame,
  index
}: {
  bookmark: BookmarkWithFolder
  folders: Folder[]
  className: string
  tall: boolean
  wide: boolean
  /** Global frame number across the whole roll, not the page. */
  frame: number
  /** Position on this page, used only to stagger the develop animation. */
  index: number
}) {
  const [editing, setEditing] = useState(false)
  const [starred, setLocalStarred] = useState(bookmark.starred)
  const [justStarred, setJustStarred] = useState(false)
  const [, startTransition] = useTransition()

  const host = hostnameOf(bookmark.url)
  const title = bookmark.title?.trim() || host
  const showPlate = tall && Boolean(bookmark.screenshot_url)
  const visibleTags = bookmark.tags.slice(0, wide ? 4 : 2)
  const hiddenTags = bookmark.tags.length - visibleTags.length

  function toggleStar() {
    const next = !starred
    setLocalStarred(next)
    // Only draw the pencil on the way in. Removing a mark should not animate.
    setJustStarred(next)

    startTransition(async () => {
      const result = await setStarred(bookmark.id, next)
      if (!result.ok) {
        setLocalStarred(!next)
        setJustStarred(false)
      }
    })
  }

  return (
    <>
      <article
        className={`frame frame-hover animate-develop group/frame flex flex-col overflow-hidden ${className}`}
        // Capped so page two does not sit there developing for four seconds.
        style={{ animationDelay: `${Math.min(index, 11) * 45}ms` }}
      >
        {/* The whole frame opens the page. Controls sit above this layer. */}
        <a
          href={bookmark.url}
          target="_blank"
          rel="noreferrer noopener"
          className="absolute inset-0 z-10"
        >
          <span className="sr-only">Open {title}</span>
        </a>

        <div className="relative flex items-center justify-between gap-2">
          <span className="frame-no shrink-0">{String(frame).padStart(2, "0")}</span>

          <div className="flex min-w-0 items-center gap-1.5">
            <Favicon src={bookmark.favicon_url} host={host} />
            <span className="truncate frame-stamp">{host}</span>
          </div>
        </div>

        {showPlate ? (
          <div className="plate relative mt-2 min-h-0 flex-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bookmark.screenshot_url as string} alt="" loading="lazy" />
          </div>
        ) : null}

        <div className={`relative min-w-0 ${showPlate ? "mt-2" : "mt-1.5 flex-1"}`}>
          <h3
            className={`font-[family-name:var(--font-head)] font-normal leading-[1.25] text-print ${
              tall ? "text-[15px] clamp-3" : "text-[13.5px] clamp-2"
            }`}
          >
            {title}
          </h3>

          {wide && bookmark.notes ? (
            <p className="mt-1 clamp-2 text-[10.5px] leading-snug text-silver-dim">{bookmark.notes}</p>
          ) : null}
        </div>

        <div className="relative mt-2 flex items-end justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            {visibleTags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
            {hiddenTags > 0 ? (
              <span className="font-[family-name:var(--font-mono)] text-[9px] text-silver-dim">
                +{hiddenTags}
              </span>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {bookmark.folder ? (
              <span className="hidden max-w-[6rem] truncate frame-stamp sm:inline">
                {bookmark.folder.name}
              </span>
            ) : null}

            <span className="frame-stamp">{isoDate(bookmark.created_at)}</span>

            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`Edit ${title}`}
              title="Edit"
              className="relative z-20 -m-1 p-1 text-silver-dim opacity-0 transition hover:text-print focus-visible:opacity-100 group-hover/frame:opacity-100"
            >
              <PencilIcon />
            </button>

            <button
              type="button"
              onClick={toggleStar}
              aria-pressed={starred}
              aria-label={starred ? "Remove the grease pencil mark" : "Mark with grease pencil"}
              title={starred ? "Remove mark" : "Mark this one"}
              className={`relative z-20 -m-0.5 h-6 w-6 shrink-0 p-0.5 text-silver-dim transition-opacity hover:text-silver ${
                starred
                  ? "opacity-100"
                  : "opacity-0 focus-visible:opacity-100 group-hover/frame:opacity-100"
              }`}
            >
              <GreaseCircle marked={starred} draw={justStarred} />
            </button>
          </div>
        </div>
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
        className="grid h-3.5 w-3.5 shrink-0 place-items-center bg-grease/80 font-[family-name:var(--font-head)] text-[8px] leading-none text-print"
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
      className="h-3.5 w-3.5 shrink-0 object-contain opacity-80"
    />
  )
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M11.2 2.5 13.5 4.8 5.6 12.7l-3 .7.7-3z" strokeLinejoin="round" />
    </svg>
  )
}
