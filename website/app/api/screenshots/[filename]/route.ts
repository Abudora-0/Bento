import { existsSync, readFileSync } from "node:fs"

import { screenshotPath } from "~/lib/db/client"

export const runtime = "nodejs"

/**
 * Deliberately not behind the bearer check. This mirrors the old Supabase
 * storage bucket, which was public read with writes scoped by policy, the
 * unguessable uuid filename is the only protection and that was true before
 * too. Both the website's own <img> tags and the popup's need to load these
 * without carrying a token.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params
  const path = screenshotPath(filename)

  if (!path || !existsSync(path)) {
    return new Response("Not found.", { status: 404 })
  }

  return new Response(new Uint8Array(readFileSync(path)), {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable"
    }
  })
}
