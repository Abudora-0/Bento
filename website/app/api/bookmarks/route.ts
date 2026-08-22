import { hasValidBearer, unauthorized } from "~/lib/auth"
import { corsJson, corsPreflight } from "~/lib/cors"
import { countBookmarks, recentBookmarks } from "~/lib/db/bookmarks"

export const runtime = "nodejs"

export function OPTIONS(request: Request) {
  return corsPreflight(request)
}

/** Feeds the popup's contact sheet strip: the newest captures plus a total count. */
export async function GET(request: Request) {
  if (!(await hasValidBearer(request))) return unauthorized(request)

  const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limit")) || 12, 1), 50)

  const [bookmarks, total] = await Promise.all([recentBookmarks(limit), countBookmarks()])

  return corsJson(request, { bookmarks, total })
}
