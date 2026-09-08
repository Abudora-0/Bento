/** How the tray is ordered. The key travels in the URL, so keep it short. */

export type SortKey = "new" | "old" | "touched" | "title" | "custom"

type SortOption = {
  key: SortKey
  label: string
  column: "created_at" | "updated_at" | "title" | "position"
  ascending: boolean
}

export const SORT_OPTIONS: SortOption[] = [
  { key: "new", label: "Newest first", column: "created_at", ascending: false },
  { key: "old", label: "Oldest first", column: "created_at", ascending: true },
  { key: "touched", label: "Recently edited", column: "updated_at", ascending: false },
  { key: "title", label: "By title", column: "title", ascending: true },
  /*
   * The one sort you can drag inside. Dragging under any other would be undone
   * the moment the sort ran again on the next load, which looks like the drag
   * silently failing.
   *
   * ascending is true and unused: loadTray gives position its own clause,
   * because rows that have never been placed are null and null sorts first in
   * SQLite, so an unplaced bookmark would otherwise lead the arrangement.
   */
  { key: "custom", label: "My arrangement", column: "position", ascending: true }
]

const DEFAULT = SORT_OPTIONS[0]

export function parseSort(value: string | undefined): SortKey {
  return SORT_OPTIONS.some((option) => option.key === value) ? (value as SortKey) : DEFAULT.key
}

export function sortOption(key: SortKey): SortOption {
  return SORT_OPTIONS.find((option) => option.key === key) ?? DEFAULT
}
