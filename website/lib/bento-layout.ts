/**
 * Compartment sizing for the tray.
 *
 * A real bento box is not a uniform card grid, it is a handful of differently
 * sized wells that tile together. The grid is 6 columns wide on a large screen
 * and packs densely, so a repeating cycle of spans gives an arrangement that
 * looks arranged by hand without ever leaving a ragged hole.
 *
 * Two things can override the cycle now: a layout preset picks a different
 * cycle, and a frame can carry a shape somebody set on it deliberately.
 */

import type { Shape } from "~/types/db"

export type Span = {
  /** Tailwind classes for column and row spans across the breakpoints. */
  className: string
  /** Cells with the vertical room for a bigger title and a note preview. */
  tall: boolean
  /** Cells wide enough to carry a note preview. */
  wide: boolean
}

/*
 * The four sizes a frame can be set to by hand.
 *
 * A fixed vocabulary rather than free width and height, because these are the
 * shapes the cycles are already built from, so a hand set frame tiles with the
 * automatic ones instead of tearing a hole in the row.
 */
export const SHAPE_SPANS: Record<Shape, Span> = {
  small: { className: "col-span-1 row-span-1 md:col-span-2 lg:col-span-2", tall: false, wide: false },
  wide: { className: "col-span-2 row-span-1 md:col-span-4 lg:col-span-4", tall: false, wide: true },
  tall: { className: "col-span-1 row-span-2 md:col-span-2 lg:col-span-2", tall: true, wide: false },
  big: { className: "col-span-2 row-span-2 md:col-span-4 lg:col-span-3", tall: true, wide: true }
}

export const SHAPE_LABELS: Record<Shape, string> = {
  small: "Small",
  wide: "Wide",
  tall: "Tall",
  big: "Big"
}

/**
 * Contact sheet, the default.
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
const CONTACT: Span[] = [
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

/** Every frame the same size. The plainest reading of a roll. */
const UNIFORM: Span[] = [SHAPE_SPANS.tall]

/** One big well then four small, for a sheet with a few pictures worth seeing. */
const FEATURE: Span[] = [
  SHAPE_SPANS.big,
  SHAPE_SPANS.small,
  SHAPE_SPANS.small,
  SHAPE_SPANS.tall,
  SHAPE_SPANS.small,
  SHAPE_SPANS.small
]

/** Everything short, so far more of the roll is on screen at once. */
const COMPACT: Span[] = [SHAPE_SPANS.small, SHAPE_SPANS.small, SHAPE_SPANS.wide]

export type LayoutKey = "contact" | "uniform" | "feature" | "compact"

type Layout = { key: LayoutKey; label: string; cycle: Span[] }

export const LAYOUTS: Layout[] = [
  { key: "contact", label: "Contact sheet", cycle: CONTACT },
  { key: "uniform", label: "Uniform", cycle: UNIFORM },
  { key: "feature", label: "One large", cycle: FEATURE },
  { key: "compact", label: "Compact", cycle: COMPACT }
]

const DEFAULT_LAYOUT = LAYOUTS[0]

export function parseLayout(value: string | undefined): LayoutKey {
  return LAYOUTS.some((layout) => layout.key === value) ? (value as LayoutKey) : DEFAULT_LAYOUT.key
}

function cycleFor(layout: LayoutKey): Span[] {
  return (LAYOUTS.find((entry) => entry.key === layout) ?? DEFAULT_LAYOUT).cycle
}

/**
 * The size a frame is drawn at.
 *
 * A shape somebody set by hand wins. Otherwise the layout's cycle decides,
 * keyed on position within the page, which is why every cycle length has to
 * divide the page size. See the test.
 */
export function compartmentFor(
  index: number,
  shape: Shape | null = null,
  layout: LayoutKey = "contact"
): Span {
  if (shape) return SHAPE_SPANS[shape]

  const cycle = cycleFor(layout)
  return cycle[index % cycle.length]
}

/** The default cycle on its own, for the skeleton, which knows neither. */
export function compartment(index: number): Span {
  return compartmentFor(index)
}

/**
 * Grid container classes, shared by the tray and its skeleton state.
 *
 * `dense` is what lets a later small cell backfill the hole a taller earlier
 * one left, which is what keeps an automatic cycle from going ragged. It is
 * exactly wrong for an arrangement somebody made by hand: with it on, the
 * browser is free to move a frame somewhere other than where it was dropped,
 * so what you saved is not what you see. See trayGrid.
 */
export const TRAY_GRID =
  "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 auto-rows-[112px] gap-3 md:gap-4 [grid-auto-flow:row_dense]"

const TRAY_GRID_EXACT =
  "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 auto-rows-[112px] gap-3 md:gap-4"

export function trayGrid(arrangeable: boolean): string {
  return arrangeable ? TRAY_GRID_EXACT : TRAY_GRID
}
