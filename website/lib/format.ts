/** Small display helpers shared across the tray. */

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export function prettyPath(url: string): string {
  try {
    const u = new URL(url)
    const path = `${u.pathname}${u.search}`.replace(/\/$/, "")
    return path === "" ? "/" : path
  } catch {
    return ""
  }
}

const DATE = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "UTC"
})

/** 2026-08-18, deliberately monospace friendly. */
export function isoDate(value: string): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "" : DATE.format(d)
}

export function relativeTime(value: string): string {
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return ""

  const seconds = Math.round((Date.now() - then) / 1000)
  if (seconds < 60) return "just now"

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`

  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo ago`

  return `${Math.round(months / 12)}y ago`
}

/** Splits "react, ui , notes" into ["react", "ui", "notes"]. */
export function parseTags(input: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  for (const raw of input.split(/[,\n]/)) {
    const tag = raw.trim().replace(/^#/, "").toLowerCase()
    if (!tag || tag.length > 32) continue
    if (seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
    if (out.length >= 12) break
  }

  return out
}
