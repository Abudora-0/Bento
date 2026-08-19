/** How the tray is ordered. The key travels in the URL, so keep it short. */

export type SortKey = "new" | "old" | "touched" | "title"

type SortOption = {
  key: SortKey
  label: string
  column: "created_at" | "updated_at" | "title"
  ascending: boolean
}

export const SORT_OPTIONS: SortOption[] = [
  { key: "new", label: "Newest first", column: "created_at", ascending: false },
  { key: "old", label: "Oldest first", column: "created_at", ascending: true },
  { key: "touched", label: "Recently edited", column: "updated_at", ascending: false },
  { key: "title", label: "By title", column: "title", ascending: true }
]

const DEFAULT = SORT_OPTIONS[0]

export function parseSort(value: string | undefined): SortKey {
  return SORT_OPTIONS.some((option) => option.key === value) ? (value as SortKey) : DEFAULT.key
}

export function sortOption(key: SortKey): SortOption {
  return SORT_OPTIONS.find((option) => option.key === key) ?? DEFAULT
}
