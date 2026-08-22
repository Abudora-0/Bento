import assert from "node:assert/strict"
import { describe, it } from "node:test"

process.env.BENTO_SECRET = "middleware-test-secret-ignore"

const { middleware } = await import("./middleware.ts")
const { SESSION_COOKIE, issueSession, idleTimeoutMs } = await import("./lib/session.ts")

const USER = "11111111-1111-1111-1111-111111111111"

/**
 * NextRequest is more than middleware actually touches. It reads the url, and
 * it reads one cookie, so a small stand in keeps these tests to the logic
 * rather than to Next's request plumbing.
 */
function request(path: string, cookie?: string) {
  /*
   * Concatenated, not new URL(path, base). The base relative form resolves a
   * leading "//" as protocol relative and silently rewrites the origin, which
   * is not what Next does. Next hands you the literal request path, so
   * "//evil.example.com/steal" really does arrive as the pathname, and that is
   * exactly the case the open redirect guard exists for.
   */
  const url = new URL(`http://localhost:3000${path}`)

  return {
    url: url.toString(),
    nextUrl: url,
    cookies: {
      get: (name: string) =>
        name === SESSION_COOKIE && cookie !== undefined ? { name, value: cookie } : undefined
    }
  } as unknown as Parameters<typeof middleware>[0]
}

function locationOf(response: Response): URL | null {
  const location = response.headers.get("location")
  return location ? new URL(location) : null
}

describe("middleware, locked", () => {
  it("redirects a page request to the lock screen", async () => {
    const response = await middleware(request("/app"))

    assert.equal(response.status, 307)
    assert.equal(locationOf(response)?.pathname, "/lock")
  })

  it("remembers where you were going", async () => {
    const response = await middleware(request("/app?tag=react&page=3"))
    const location = locationOf(response)

    assert.equal(location?.searchParams.get("next"), "/app?tag=react&page=3")
  })

  it("does not carry a bare slash as a destination, that is just the default", async () => {
    const response = await middleware(request("/"))
    assert.equal(locationOf(response)?.searchParams.has("next"), false)
  })

  it("says when it locked itself, so the screen can explain", async () => {
    const stale = await issueSession(USER, { issuedAt: Date.now() - idleTimeoutMs() - 1000 })
    const response = await middleware(request("/app", stale))

    assert.equal(locationOf(response)?.searchParams.get("why"), "idle")
  })

  it("does not claim idleness for a token that was never valid", async () => {
    const response = await middleware(request("/app", "garbage"))
    assert.equal(locationOf(response)?.searchParams.has("why"), false)
  })

  it("clears the stale cookie on the way out", async () => {
    const stale = await issueSession(USER, { issuedAt: Date.now() - idleTimeoutMs() - 1000 })
    const response = await middleware(request("/app", stale))

    // A cleared cookie is set to empty with an expiry in the past.
    assert.match(response.headers.get("set-cookie") ?? "", /bento_session=;/)
  })
})

describe("middleware, the lock screen itself", () => {
  it("lets the lock screen render while locked, or it would redirect to itself forever", async () => {
    const response = await middleware(request("/lock"))

    assert.equal(response.headers.get("location"), null)
    assert.notEqual(response.status, 307)
  })

  it("still renders the lock screen when the cookie is merely stale", async () => {
    const stale = await issueSession(USER, { issuedAt: Date.now() - idleTimeoutMs() - 1000 })
    const response = await middleware(request("/lock", stale))

    assert.equal(response.headers.get("location"), null)
  })

  it("bounces someone already unlocked off it", async () => {
    const response = await middleware(request("/lock", await issueSession(USER)))

    assert.equal(locationOf(response)?.pathname, "/app")
  })
})

describe("middleware, unlocked", () => {
  it("lets a valid session through", async () => {
    const response = await middleware(request("/app", await issueSession(USER)))

    assert.equal(response.headers.get("location"), null)
  })

  it("slides the window forward on a session that has been open a while", async () => {
    const older = await issueSession(USER, { issuedAt: Date.now() - 5 * 60_000 })
    const response = await middleware(request("/app", older))

    const setCookie = response.headers.get("set-cookie") ?? ""
    assert.match(setCookie, /bento_session=/)
    assert.match(setCookie, /HttpOnly/i)
    assert.match(setCookie, /SameSite=lax/i)
    // No Max-Age or Expires, so it still dies with the browser.
    assert.doesNotMatch(setCookie, /Max-Age|Expires/i)
  })

  it("does not re-sign on every single navigation", async () => {
    const response = await middleware(request("/app", await issueSession(USER)))

    assert.equal(response.headers.get("set-cookie"), null)
  })
})

describe("middleware, open redirect", () => {
  it("refuses to carry an absolute url as the destination", async () => {
    // A protocol relative path is the classic way past a naive startsWith("/").
    const response = await middleware(request("//evil.example.com/steal"))
    const next = locationOf(response)?.searchParams.get("next")

    assert.equal(next, null, "a protocol relative path must not become a destination")
  })

  it("keeps the redirect on this origin", async () => {
    const response = await middleware(request("/app"))
    assert.equal(locationOf(response)?.origin, "http://localhost:3000")
  })
})
