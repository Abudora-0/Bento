"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"

import { bulkUpdate, setStarred } from "~/app/(dashboard)/actions"
import { TRAY_GRID, compartment } from "~/lib/bento-layout"
import type { BookmarkWithFolder, Folder } from "~/types/db"

import { BookmarkCell } from "./BookmarkCell"
import { Loupe } from "./Loupe"
import { Select, folderOptions } from "./Select"

/**
 * The sheet, and everything you can do to it without a mouse.
 *
 * Marking up a contact sheet is a keyboard job: you move across the frames,
 * ring the ones worth keeping, and put a glass over anything you cannot judge
 * at that size. So the grid owns a cursor, a selection, and the loupe, rather
 * than each frame minding itself.
 *
 * Selection lives here rather than in the url because it is a scratch state,
 * not a view: it should not survive a reload, and it should not be shareable.
 */
export function Sheet({
  rows,
  folders,
  from,
  page
}: {
  rows: BookmarkWithFolder[]
  folders: Folder[]
  /** Offset of the first row on this page, for the global frame number. */
  from: number
  page: number
}) {
  const [cursor, setCursor] = useState(-1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loupe, setLoupe] = useState(-1)
  const [pending, startTransition] = useTransition()
  const gridRef = useRef<HTMLDivElement>(null)

  // A new page is a new set of frames, so nothing carries across.
  useEffect(() => {
    setCursor(-1)
    setSelected(new Set())
    setLoupe(-1)
  }, [page])

  const toggleSelected = useCallback((id: string) => {
    setSelected((was) => {
      const next = new Set(was)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  /**
   * How many frames sit on a row right now.
   *
   * Measured from the grid rather than assumed, because the compartments vary
   * in width and the column count changes with the breakpoint. Counting the
   * children that share a top offset is the only honest answer.
   */
  const columnsAt = useCallback((index: number): number => {
    const cells = gridRef.current?.children
    if (!cells || cells.length === 0) return 1

    const target = (cells[index] as HTMLElement | undefined)?.offsetTop
    if (target === undefined) return 1

    let n = 0
    for (const cell of cells) if ((cell as HTMLElement).offsetTop === target) n++
    return Math.max(1, n)
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // The same guard the search field uses. Arrow keys belong to whatever
      // you are typing in, and to the palette and the loupe while they are up.
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (target?.isContentEditable) return
      if (document.querySelector('[role="dialog"]')) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (rows.length === 0) return

      const step = (delta: number) => {
        event.preventDefault()
        setCursor((was) => {
          const next = was < 0 ? 0 : was + delta
          return Math.max(0, Math.min(rows.length - 1, next))
        })
      }

      switch (event.key) {
        case "ArrowRight":
          return step(1)
        case "ArrowLeft":
          return step(-1)
        case "ArrowDown":
          return step(columnsAt(Math.max(0, cursor)))
        case "ArrowUp":
          return step(-columnsAt(Math.max(0, cursor)))
        case "Home":
          event.preventDefault()
          return setCursor(0)
        case "End":
          event.preventDefault()
          return setCursor(rows.length - 1)
      }

      if (cursor < 0) return
      const bookmark = rows[cursor]
      if (!bookmark) return

      if (event.key === " ") {
        event.preventDefault()
        setLoupe(cursor)
      } else if (event.key === "Enter") {
        event.preventDefault()
        window.open(bookmark.url, "_blank", "noreferrer,noopener")
      } else if (event.key.toLowerCase() === "s") {
        event.preventDefault()
        startTransition(async () => {
          await setStarred(bookmark.id, !bookmark.starred)
        })
      } else if (event.key.toLowerCase() === "x") {
        event.preventDefault()
        toggleSelected(bookmark.id)
      } else if (event.key === "Escape") {
        event.preventDefault()
        setSelected(new Set())
        setCursor(-1)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [cursor, rows, columnsAt, toggleSelected])

  // Keep the cursor on screen when it walks off the bottom.
  useEffect(() => {
    if (cursor < 0) return
    ;(gridRef.current?.children[cursor] as HTMLElement | undefined)?.scrollIntoView({
      block: "nearest",
      behavior: "smooth"
    })
  }, [cursor])

  function runBulk(action: Parameters<typeof bulkUpdate>[1]) {
    const ids = [...selected]
    startTransition(async () => {
      await bulkUpdate(ids, action)
      setSelected(new Set())
    })
  }

  return (
    <>
      <div ref={gridRef} key={page} className={`animate-advance ${TRAY_GRID}`}>
        {rows.map((bookmark, index) => {
          const shape = compartment(index)
          return (
            <BookmarkCell
              key={bookmark.id}
              bookmark={bookmark}
              folders={folders}
              className={shape.className}
              tall={shape.tall}
              wide={shape.wide}
              frame={from + index + 1}
              index={index}
              cursored={index === cursor}
              selected={selected.has(bookmark.id)}
              selecting={selected.size > 0}
              onSelect={() => toggleSelected(bookmark.id)}
              onLoupe={() => setLoupe(index)}
            />
          )
        })}
      </div>

      {selected.size > 0 ? (
        <BulkBar
          count={selected.size}
          folders={folders}
          pending={pending}
          onStar={(starred) => runBulk({ kind: "star", starred })}
          onFile={(folderId) => runBulk({ kind: "file", folderId })}
          onDelete={() => runBulk({ kind: "delete" })}
          onClear={() => setSelected(new Set())}
        />
      ) : null}

      {loupe >= 0 ? (
        <Loupe bookmarks={rows} index={loupe} onIndex={setLoupe} onClose={() => setLoupe(-1)} />
      ) : null}
    </>
  )
}

/**
 * The action bar for a selection.
 *
 * Fixed to the bottom rather than sitting in the flow, because the selection is
 * made by scrolling around the sheet and a bar that scrolls away with it would
 * be useless by the time you wanted it.
 */
function BulkBar({
  count,
  folders,
  pending,
  onStar,
  onFile,
  onDelete,
  onClear
}: {
  count: number
  folders: Folder[]
  pending: boolean
  onStar: (starred: boolean) => void
  onFile: (folderId: string | null) => void
  onDelete: () => void
  onClear: () => void
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3">
      <div
        role="group"
        aria-label={`${count} selected`}
        className="animate-loupe flex w-full max-w-2xl flex-wrap items-center gap-2 bg-darkroom p-2"
        style={{ boxShadow: "inset 0 0 0 1px var(--line-live)" }}
      >
        <span className="px-1 text-[10px] uppercase tracking-[0.16em] text-print tabular-nums">
          {count} selected
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" className="ghost-btn" disabled={pending} onClick={() => onStar(true)}>
            Mark
          </button>
          <button type="button" className="ghost-btn" disabled={pending} onClick={() => onStar(false)}>
            Unmark
          </button>

          <Select
            ariaLabel="File the selection"
            label="File into"
            value=""
            options={folderOptions(folders)}
            onChange={(value) => onFile(value === "none" ? null : value)}
            className="w-32"
          />

          {confirming ? (
            <button
              type="button"
              className="shutter"
              disabled={pending}
              onClick={() => {
                setConfirming(false)
                onDelete()
              }}
            >
              {pending ? "Removing" : `Really delete ${count}`}
            </button>
          ) : (
            <button type="button" className="ghost-btn" disabled={pending} onClick={() => setConfirming(true)}>
              Delete
            </button>
          )}

          <button type="button" className="ghost" onClick={onClear}>
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}
