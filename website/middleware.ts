import { NextResponse, type NextRequest } from "next/server"

import { secret, secretsMatch } from "~/lib/auth"

/**
 * Bento has one user, so instead of an account system this is a single
 * password gate. Basic Auth rather than a login page because the browser
 * handles the prompt and the credential storage itself, there is nothing here
 * to build or to get wrong.
 *
 * Api routes are not covered, they are for the extension and check a bearer
 * token themselves, see lib/auth.ts and app/api/*\/route.ts.
 */
export async function middleware(request: NextRequest) {
  const header = request.headers.get("authorization") ?? ""
  const match = /^Basic (.+)$/.exec(header)

  if (match) {
    const decoded = atob(match[1])
    const colonAt = decoded.indexOf(":")
    const password = colonAt === -1 ? decoded : decoded.slice(colonAt + 1)

    try {
      if (await secretsMatch(password, secret())) return NextResponse.next()
    } catch {
      // secret() throws if BENTO_SECRET is not configured. Falling through to
      // the 401 below is more honest than silently letting everyone in.
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Bento", charset="UTF-8"' }
  })
}

export const config = {
  matcher: [
    /*
     * Everything except the api routes (which authenticate themselves with a
     * bearer token) and static assets.
     */
    "/((?!api/|_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"
  ]
}
