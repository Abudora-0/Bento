/**
 * Compartment sizing for the tray.
 *
 * A real bento box is not a uniform card grid, it is a handful of differently
 * sized wells that tile together. The grid is 6 columns wide on a large screen
 * and packs densely, so a repeating cycle of spans gives an arrangement that
 * looks arranged by hand without ever leaving a ragged hole.
 *
 * Cycle (large screens, 6 column track):
 *   0  3x2  the main well
 *   1  3x1  a long shallow well
 *   2  2x1
 *   3  2x2  a deep square well
 *   4  2x1
 *   5  4x1  the wide sauce well
 *   6  2x2
 *   7  2x1
 *   8  2x1
 */

type Span = {
  /** Tailwind classes for column and row spans across the breakpoints. */
  className: string
  /** Cells that get extra vertical room can show a screenshot. */
  tall: boolean
  /** Cells wide enough to carry a note preview. */
  wide: boolean
}

const CYCLE: Span[] = [
  { className: "col-span-2 row-span-2 md:col-span-4 lg:col-span-3", tall: true, wide: true },
  { className: "col-span-2 row-span-1 md:col-span-2 lg:col-span-3", tall: false, wide: true },
  { className: "col-span-1 row-span-1 md:col-span-2 lg:col-span-2", tall: false, wide: false },
  { className: "col-span-1 row-span-2 md:col-span-2 lg:col-span-2 lg:row-span-2", tall: true, wide: false },
  { className: "col-span-2 row-span-1 md:col-span-2 lg:col-span-2", tall: false, wide: false },
  { className: "col-span-2 row-span-1 md:col-span-4 lg:col-span-4", tall: false, wide: true },
  { className: "col-span-1 row-span-2 md:col-span-2 lg:col-span-2 lg:row-span-2", tall: true, wide: false },
  { className: "col-span-1 row-span-1 md:col-span-2 lg:col-span-2", tall: false, wide: false },
  { className: "col-span-2 row-span-1 md:col-span-2 lg:col-span-2", tall: false, wide: false }
]

export function compartment(index: number): Span {
  return CYCLE[index % CYCLE.length]
}

/** Grid container classes, shared by the tray and its skeleton state. */
export const TRAY_GRID =
  "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 auto-rows-[112px] gap-3 md:gap-4 [grid-auto-flow:row_dense]"
