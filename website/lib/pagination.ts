/**
 * Paging for the tray.
 *
 * Offset paging rather than a keyset cursor. The tray can be ordered four
 * different ways, so a cursor would need a composite key per sort, and a
 * personal bookmark collection never reaches the depth where an offset scan
 * starts to hurt. Offsets also give real page numbers, which a stack of trays
 * wants and a cursor cannot provide.
 */

/** Four turns of the nine shape compartment cycle, so a full page tiles cleanly. */
export const PAGE_SIZE = 36

export function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  // Nothing legitimate asks for page ten thousand, and this keeps the offset sane.
  return Math.min(parsed, 10_000)
}

/** Row offset for the start of a page, what SQLite's LIMIT/OFFSET wants. */
export function pageOffset(page: number): number {
  return (page - 1) * PAGE_SIZE
}

export function totalPages(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE))
}

/**
 * The page numbers to draw. null marks a gap where numbers were skipped.
 *
 * The ends are padded so the strip keeps a steady width as you move through it,
 * rather than growing and shrinking under the cursor.
 */
export function pageWindow(current: number, last: number): (number | null)[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)

  const wanted = new Set([1, last, current - 1, current, current + 1])

  if (current <= 4) for (const n of [2, 3, 4, 5]) wanted.add(n)
  if (current >= last - 3) for (const n of [last - 1, last - 2, last - 3, last - 4]) wanted.add(n)

  const shown = [...wanted].filter((n) => n >= 1 && n <= last).sort((a, b) => a - b)

  const out: (number | null)[] = []
  let previous = 0

  for (const n of shown) {
    if (previous && n - previous > 1) out.push(null)
    out.push(n)
    previous = n
  }

  return out
}
