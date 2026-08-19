/**
 * Builds a /app URL with one or more filter params changed.
 *
 * Changing a filter drops the page number, because page 4 of the old result set
 * means nothing in the new one and landing on an empty tray after clicking a tag
 * is baffling. Paging links pass "page" in the patch, which keeps it.
 */
export function trayHref(
  current: URLSearchParams | ReadonlyURLSearchParamsLike,
  patch: Record<string, string | null>
): string {
  const next = new URLSearchParams(current.toString())

  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") next.delete(key)
    else next.set(key, value)
  }

  if (!("page" in patch)) next.delete("page")

  const qs = next.toString()
  return qs ? `/app?${qs}` : "/app"
}

type ReadonlyURLSearchParamsLike = { toString(): string }
