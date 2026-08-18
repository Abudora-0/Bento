/** Builds a /app URL with one or more filter params changed. */
export function trayHref(
  current: URLSearchParams | ReadonlyURLSearchParamsLike,
  patch: Record<string, string | null>
): string {
  const next = new URLSearchParams(current.toString())

  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") next.delete(key)
    else next.set(key, value)
  }

  const qs = next.toString()
  return qs ? `/app?${qs}` : "/app"
}

type ReadonlyURLSearchParamsLike = { toString(): string }
