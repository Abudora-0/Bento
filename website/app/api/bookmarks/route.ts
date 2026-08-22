import { unauthorized, userFromBearer } from "~/lib/auth"
import { corsJson, corsPreflight } from "~/lib/cors"
import { countBookmarks, recentBookmarks } from "~/lib/db/bookmarks"

export const runtime = "nodejs"

export function OPTIONS(request: Request) {
  return corsPreflight(request)
}

/** Feeds the popup's contact sheet strip: the newest captures plus a total count. */
export async function GET(request: Request) {
  const user = await userFromBearer(request)
  if (!user) return unauthorized(request)

  const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limit")) || 12, 1), 50)

  const [bookmarks, total] = await Promise.all([recentBookmarks(user.id, limit), countBookmarks(user.id)])

  return corsJson(request, { bookmarks, total })
}
