import { NextResponse, type NextRequest } from "next/server"

import { SESSION_COOKIE, issueSession, readSession, sessionCookieOptions } from "~/lib/session"

export const LOCK_PATH = "/lock"

/**
 * The gate in front of every page.
 *
 * Api routes are not covered by the matcher below: they are the extension's,
 * and they check a bearer token themselves. That separation is what lets the
 * lock change without the extension noticing, and it is also why the session
 * cookie never needs to travel cross origin.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  const session = await readSession(request.cookies.get(SESSION_COOKIE)?.value)

  // The lock screen has to be reachable while locked, or it would redirect to
  // itself forever. Anyone who is already in gets bounced off it instead.
  if (pathname === LOCK_PATH) {
    if (session.valid) return NextResponse.redirect(new URL("/app", request.url))
    return NextResponse.next()
  }

  if (!session.valid) {
    const url = new URL(LOCK_PATH, request.url)

    // Remember where they were headed, but only ever as a path on this site.
    // Taking the raw value would let a crafted link bounce someone off to
    // another origin straight after they type their password.
    const target = `${pathname}${search}`
    if (target !== "/" && target.startsWith("/") && !target.startsWith("//")) {
      url.searchParams.set("next", target)
    }
    if (session.reason === "expired") url.searchParams.set("why", "idle")

    const response = NextResponse.redirect(url)
    // Clear the stale cookie so the browser stops sending it.
    response.cookies.delete(SESSION_COOKIE)
    return response
  }

  const response = NextResponse.next()

  /*
   * Slide the window forward. Re-issuing on every navigation is what makes the
   * timeout mean "idle for 30 minutes" rather than "30 minutes since you first
   * signed in". Only bother once a minute of the window has actually elapsed,
   * so a burst of navigations does not re-sign a token on every one.
   */
  if (Date.now() - session.issuedAt > 60_000) {
    // Carrying `remember` forward matters: dropping it here would silently
    // downgrade a "stay signed in" session to one that dies with the browser,
    // on the very next navigation.
    response.cookies.set(
      SESSION_COOKIE,
      await issueSession(session.userId, { remember: session.remember }),
      sessionCookieOptions(request.nextUrl.protocol === "https:", session.remember)
    )
  }

  return response
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
