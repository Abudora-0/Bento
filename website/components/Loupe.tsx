"use client"

import { useEffect } from "react"

import { hostnameOf, isoDate, prettyPath } from "~/lib/format"
import type { BookmarkWithFolder } from "~/types/db"

/**
 * A loupe over the contact sheet.
 *
 * The one gesture a contact sheet actually asks for: you do not read a sheet,
 * you scan it and then put a glass over the frame you want. Space or a click on
 * the frame number blows the capture up, and the arrow keys walk the roll
 * without dropping back to the grid in between.
 *
 * Deliberately not the Modal component. Modal is a dialog with a hairline box
 * and padding, sized for a form; this wants the whole viewport, no chrome and
 * its own keyboard handling, and bending Modal to do that would leave both
 * worse. It repeats the escape and scroll lock rather than sharing them, which
 * is the smaller cost.
 */
export function Loupe({
  bookmarks,
  index,
  onIndex,
  onClose
}: {
  bookmarks: BookmarkWithFolder[]
  index: number
  onIndex: (next: number) => void
  onClose: () => void
}) {
  const bookmark = bookmarks[index]

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        onIndex(Math.min(bookmarks.length - 1, index + 1))
      } else if (event.key === "ArrowLeft") {
        event.preventDefault()
        onIndex(Math.max(0, index - 1))
      }
    }

    window.addEventListener("keydown", onKeyDown)
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      window.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previous
    }
  }, [index, bookmarks.length, onIndex, onClose])

  if (!bookmark) return null

  const host = hostnameOf(bookmark.url)
  const title = bookmark.title?.trim() || host

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Loupe on ${title}`}
      className="animate-backdrop fixed inset-0 z-50 flex flex-col bg-gutter/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex items-baseline justify-between gap-4 px-4 py-3 sm:px-6">
        <span className="frame-no">{String(index + 1).padStart(2, "0")}</span>
        <span className="frame-stamp truncate">
          {index + 1} of {bookmarks.length}
        </span>
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </div>

      {/* Stops a click on the print itself from closing the glass. */}
      <div
        className="animate-loupe flex min-h-0 flex-1 items-center justify-center px-4 pb-2 sm:px-6"
        onClick={(event) => event.stopPropagation()}
      >
        {bookmark.screenshot_url ? (
          <img
            src={bookmark.screenshot_url}
            alt=""
            className="max-h-full max-w-full object-contain"
            style={{ filter: "grayscale(0.12) contrast(1.04)" }}
          />
        ) : (
          <div className="frame-blank grid h-64 w-full max-w-2xl place-items-center">
            <p className="text-[11px] uppercase tracking-[0.16em] text-silver-dim">
              Unexposed, no capture for this one
            </p>
          </div>
        )}
      </div>

      <div
        className="flex items-baseline justify-between gap-4 px-4 py-3 sm:px-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="truncate font-[family-name:var(--font-head)] text-sm text-print">{title}</p>
          <p className="truncate text-[10.5px] text-silver-dim">
            {host}
            {prettyPath(bookmark.url)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="frame-stamp">{isoDate(bookmark.created_at)}</span>
          <a
            href={bookmark.url}
            target="_blank"
            rel="noreferrer noopener"
            className="ghost-btn"
            onClick={(event) => event.stopPropagation()}
          >
            Open
          </a>
        </div>
      </div>
    </div>
  )
}
