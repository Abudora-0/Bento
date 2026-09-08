"use client"

import { useCallback, useRef, useState } from "react"

import type { BookmarkWithFolder } from "~/types/db"

/**
 * Dragging frames around the sheet.
 *
 * Hand rolled on pointer events rather than pulled in as a library, which is
 * the same call the animations made: there is no drag library here and one
 * would be a dependency for about eighty lines. Pointer events also cover
 * touch without a second code path, and the sheet has to work on a phone.
 *
 * The frame is not lifted out and floated under the cursor. It moves inside
 * the grid to wherever you are pointing, and the others close up around it.
 * That is a deliberate simplification and it buys a lot: nothing leaves the
 * flow, so there is no placeholder to keep in step, no transform to recompute
 * every time the order changes underneath it, and what you see during the drag
 * is exactly the arrangement that gets saved.
 *
 * Only usable when the sheet is sorted by the arrangement. Under any other
 * sort a drag would be undone by the sort on the next load, which reads as the
 * drag silently failing. See TrayToolbar.
 */
export function useArrange({
  rows,
  enabled,
  gridRef,
  onCommit
}: {
  rows: BookmarkWithFolder[]
  enabled: boolean
  gridRef: React.RefObject<HTMLDivElement | null>
  onCommit: (ids: string[]) => void
}) {
  const [order, setOrder] = useState<string[] | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const moved = useRef(false)

  /*
   * The server's order wins whenever it changes, and it is compared by content
   * rather than by array identity: rows is a new array on every render of the
   * parent, so an effect keyed on it would throw away a drag in progress.
   *
   * Adjusted during render, which is React's documented way to reset state
   * when a prop changes, and the same pattern BookmarkCell uses to put a star
   * back in step. An effect would leave one frame showing the old order.
   */
  const serverKey = rows.map((row) => row.id).join(",")
  const [seen, setSeen] = useState(serverKey)
  if (seen !== serverKey) {
    setSeen(serverKey)
    setOrder(null)
  }

  const ids = order ?? rows.map((row) => row.id)

  // Reordered by id rather than by index, so a row the server dropped while a
  // drag was in flight simply disappears instead of rendering as undefined.
  const byId = new Map(rows.map((row) => [row.id, row]))
  const displayed = ids
    .map((id) => byId.get(id))
    .filter((row): row is BookmarkWithFolder => row !== undefined)

  /** The frame under a point, by index, ignoring the one being dragged. */
  const frameAt = useCallback(
    (x: number, y: number, skip: number): number => {
      const cells = gridRef.current?.children
      if (!cells) return -1

      for (let i = 0; i < cells.length; i++) {
        if (i === skip) continue
        const box = (cells[i] as HTMLElement).getBoundingClientRect()
        if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) return i
      }

      return -1
    },
    [gridRef]
  )

  const move = useCallback((from: number, to: number) => {
    setOrder((was) => {
      const next = was ? [...was] : null
      if (!next) return was
      const [lifted] = next.splice(from, 1)
      next.splice(to, 0, lifted)
      return next
    })
  }, [])

  const onPointerDown = useCallback(
    (event: React.PointerEvent, index: number) => {
      // Primary button only, so a right click still opens the context menu.
      if (!enabled || event.button !== 0) return

      /*
       * Captured on the grid, not on the frame that was pressed.
       *
       * The frame is about to move somewhere else in the grid, and the move
       * and release handlers live on the grid, so capturing on the frame would
       * mean releasing on an element that never had the capture, which throws.
       * Capturing on the container also keeps the events coming when the
       * pointer wanders off the sheet mid drag.
       */
      event.preventDefault()
      gridRef.current?.setPointerCapture(event.pointerId)

      moved.current = false
      setOrder(ids)
      setDraggingId(ids[index])
    },
    [enabled, ids, gridRef]
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!draggingId) return

      const at = ids.indexOf(draggingId)
      const over = frameAt(event.clientX, event.clientY, at)
      if (over < 0 || over === at) return

      moved.current = true
      move(at, over)
    },
    [draggingId, ids, frameAt, move]
  )

  const onPointerUp = useCallback(
    (event: React.PointerEvent) => {
      if (!draggingId) return

      if (gridRef.current?.hasPointerCapture(event.pointerId)) {
        gridRef.current.releasePointerCapture(event.pointerId)
      }
      setDraggingId(null)

      // A press that never moved is not a drag, and committing it would be a
      // write to the database for having touched a frame.
      if (moved.current) onCommit(ids)
      else setOrder(null)
    },
    [draggingId, ids, onCommit, gridRef]
  )

  /**
   * The keyboard equivalent, so this is not a mouse only feature.
   *
   * Called with the cursor's index and how far to shift it. One step is the
   * next frame, a row's worth is the frame below, which is what the caller
   * works out by measuring the grid.
   */
  const shift = useCallback(
    (index: number, delta: number) => {
      if (!enabled || index < 0 || index >= ids.length) return

      const to = Math.max(0, Math.min(ids.length - 1, index + delta))
      if (to === index) return

      const next = [...ids]
      const [lifted] = next.splice(index, 1)
      next.splice(to, 0, lifted)

      setOrder(next)
      onCommit(next)
      return to
    },
    [enabled, ids, onCommit]
  )

  return { displayed, draggingId, onPointerDown, onPointerMove, onPointerUp, shift }
}
