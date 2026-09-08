import { normalizeUrl } from "./format.ts"

/**
 * Reads the bookmark file every browser exports.
 *
 * Chrome, Brave, Edge, Firefox, Safari and Opera all write the same thing: the
 * Netscape bookmark format, which is HTML from 1996 with unclosed tags and
 * folders expressed as nesting. It is the one format they agree on, which is
 * why the import is a file upload rather than something that reads a browser's
 * profile or asks the extension for its bookmarks. It also means Firefox is
 * covered, which the extension could never do, since that build is Chromium.
 *
 * A scanner rather than DOMParser, so this is a pure function that runs in a
 * test as happily as in a browser. The format is machine written and very
 * regular, so there is no need for a real HTML parser here.
 */

/**
 * Bookmarks per request when uploading.
 *
 * Lives here rather than beside the server action that uses it, because a
 * "use server" file may only export async functions. Exporting a plain const
 * from one fails the build with an error the type checker cannot see.
 */
export const IMPORT_CHUNK = 100

/**
 * Bookmarks per share image batch.
 *
 * Much smaller than a chunk of imports, because each one is an outbound
 * request to somebody else's server with a four second timeout rather than a
 * row to write. Lives here for the same reason IMPORT_CHUNK does.
 */
export const BACKFILL_BATCH = 10

export type ImportedBookmark = {
  url: string
  title: string
  /** The deepest folder the bookmark sat in, or null for the browser's root. */
  folder: string | null
  faviconUrl: string | null
  /** When the browser says it was first saved, so the sheet keeps its order. */
  addedAt: string | null
}

export type ParseResult = {
  bookmarks: ImportedBookmark[]
  folders: string[]
  /** Counts by reason, so the preview can say what it left behind and why. */
  skipped: Record<string, number>
}

/*
 * The containers a browser makes for you rather than folders you made. Landing
 * everything in a folder called "Bookmarks bar" would be noise, so these count
 * as the root and their contents arrive unfiled.
 */
const ROOT_FOLDERS = new Set([
  "bookmarks bar",
  "bookmarks toolbar",
  "bookmarks menu",
  "other bookmarks",
  "mobile bookmarks",
  "favorites bar",
  "favourites bar",
  "bookmarks"
])

/** Titles come out of the file with entities still in them. */
function decodeEntities(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    // Ampersand last, or an already decoded &amp;lt; would turn into a tag.
    .replace(/&amp;/gi, "&")
    .trim()
}

function attribute(attrs: string, name: string): string | null {
  const quoted = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i").exec(attrs)
  if (quoted) return quoted[1]

  const single = new RegExp(`${name}\\s*=\\s*'([^']*)'`, "i").exec(attrs)
  if (single) return single[1]

  const bare = new RegExp(`${name}\\s*=\\s*([^\\s>]+)`, "i").exec(attrs)
  return bare ? bare[1] : null
}

/**
 * The embedded icon, when the browser included one and it is safe to render.
 *
 * Chrome and Edge inline a base64 favicon in an ICON attribute, which is worth
 * keeping: an imported sheet arrives with its icons already on it and makes no
 * network requests to get them. Firefox usually omits it, and those bookmarks
 * fall back to the lettered mark the frame already draws.
 *
 * Only data:image is allowed through. The value ends up in an img src, and
 * this file came from outside, so anything that is not an image is dropped
 * rather than trusted. Oversized ones go too, since a favicon that large is a
 * mistake and it would be carried in every tray query afterwards.
 */
const MAX_ICON_BYTES = 8 * 1024

function safeIcon(raw: string | null): string | null {
  if (!raw) return null

  const value = raw.trim()
  if (!/^data:image\/(png|jpeg|jpg|gif|webp|x-icon|vnd\.microsoft\.icon|svg\+xml);base64,/i.test(value)) {
    return null
  }
  if (value.length > MAX_ICON_BYTES) return null

  return value
}

function addedAtFrom(attrs: string): string | null {
  const raw = attribute(attrs, "ADD_DATE")
  if (!raw) return null

  const seconds = Number(raw)
  // Browsers write unix seconds. Anything outside a sane range is not a date.
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 4_102_444_800) return null

  return new Date(seconds * 1000).toISOString()
}

/**
 * Everything of interest, in document order.
 *
 * A folder's H3 comes before the DL holding its contents, so the stack is
 * pushed on DL rather than on H3, with the name held until then.
 */
const TOKENS = /<DL[^>]*>|<\/DL>|<H3[^>]*>([\s\S]*?)<\/H3>|<A\s+([^>]*)>([\s\S]*?)<\/A>/gi

export function parseNetscapeBookmarks(html: string): ParseResult {
  const bookmarks: ImportedBookmark[] = []
  const folders = new Set<string>()
  const skipped: Record<string, number> = {}

  const stack: (string | null)[] = []
  let pendingFolder: string | null = null
  const seen = new Set<string>()

  const skip = (reason: string) => {
    skipped[reason] = (skipped[reason] ?? 0) + 1
  }

  for (const match of html.matchAll(TOKENS)) {
    const [token, h3Text, anchorAttrs, anchorText] = match

    if (/^<DL/i.test(token)) {
      stack.push(pendingFolder)
      pendingFolder = null
      continue
    }

    if (/^<\/DL/i.test(token)) {
      stack.pop()
      continue
    }

    if (h3Text !== undefined) {
      const name = decodeEntities(h3Text)
      pendingFolder = name && !ROOT_FOLDERS.has(name.toLowerCase()) ? name : null
      continue
    }

    if (anchorAttrs === undefined) continue

    const href = attribute(anchorAttrs, "HREF")
    if (!href) {
      skip("no address")
      continue
    }

    /*
     * The same guard the manual add form uses, so an import cannot put
     * anything in the database that typing it in by hand could not. This is
     * what drops the javascript: bookmarklets, the place: smart folders
     * Firefox exports, and chrome:// internal pages.
     */
    const url = normalizeUrl(href)
    if (!url) {
      skip("not a web address")
      continue
    }

    if (seen.has(url)) {
      skip("duplicate in the file")
      continue
    }
    seen.add(url)

    // The deepest real folder on the stack, which is the one the owner sees.
    let folder: string | null = null
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i]) {
        folder = stack[i]
        break
      }
    }
    if (folder) folders.add(folder)

    bookmarks.push({
      url,
      title: decodeEntities(anchorText ?? "").slice(0, 500),
      folder,
      faviconUrl: safeIcon(attribute(anchorAttrs, "ICON")),
      addedAt: addedAtFrom(anchorAttrs)
    })
  }

  return { bookmarks, folders: [...folders].sort((a, b) => a.localeCompare(b)), skipped }
}
