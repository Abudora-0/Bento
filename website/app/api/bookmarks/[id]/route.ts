import { unauthorized, userFromBearer } from "~/lib/auth"
import { corsJson, corsPreflight } from "~/lib/cors"
import { getBookmark, setStarred } from "~/lib/db/bookmarks"

export const runtime = "nodejs"

export function OPTIONS(request: Request) {
  return corsPreflight(request)
}

/** Only starring, which is the one edit the popup itself makes to an existing row. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await userFromBearer(request)
  if (!user) return unauthorized(request)

  const { id } = await params
  const body = (await request.json().catch(() => null)) as { starred?: unknown } | null

  if (!body || typeof body.starred !== "boolean") {
    return corsJson(request, { error: "Expected { starred: boolean }." }, { status: 400 })
  }

  const ok = await setStarred(user.id, id, body.starred)
  if (!ok) return corsJson(request, { error: "No bookmark with that id." }, { status: 404 })

  return corsJson(request, { bookmark: await getBookmark(user.id, id) })
}
