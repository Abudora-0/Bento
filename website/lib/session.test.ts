import assert from "node:assert/strict"
import { describe, it } from "node:test"

// The session module reads BENTO_SECRET when it signs, so the environment has
// to exist before anything is imported. No database is involved at all here,
// these are pure functions over a string.
process.env.BENTO_SECRET = "session-test-secret-please-ignore"
process.env.BENTO_USER = "session-test-user"

const { SESSION_COOKIE, idleTimeoutMs, issueSession, readSession, sessionCookieOptions, username } =
  await import("./session.ts")

describe("issueSession and readSession", () => {
  it("accepts a token it just issued", async () => {
    const result = await readSession(await issueSession())
    assert.equal(result.valid, true)
  })

  it("rejects a missing token", async () => {
    const result = await readSession(undefined)
    assert.deepEqual(result, { valid: false, reason: "invalid" })
  })

  it("rejects an empty or malformed token", async () => {
    for (const bad of ["", "nodot", "a.b.c.d", ".", "..", "!!!.???"]) {
      const result = await readSession(bad)
      assert.equal(result.valid, false, `${JSON.stringify(bad)} should not verify`)
    }
  })

  it("rejects a tampered payload", async () => {
    const token = await issueSession()
    const [payload, signature] = token.split(".")

    // Re-sign nothing, just move the clock forward in the payload and keep the
    // old signature. This is the attack the HMAC exists to stop.
    const forged = `${Buffer.from(String(Date.now())).toString("base64url")}.${signature}`

    assert.notEqual(forged, token)
    assert.equal((await readSession(forged)).valid, false)
    assert.notEqual(payload, undefined)
  })

  it("rejects a tampered signature", async () => {
    const [payload] = (await issueSession()).split(".")
    const result = await readSession(`${payload}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`)
    assert.equal(result.valid, false)
  })

  it("rejects a token signed with a different secret", async () => {
    const token = await issueSession()

    const original = process.env.BENTO_SECRET
    process.env.BENTO_SECRET = "a-completely-different-secret"
    const result = await readSession(token)
    process.env.BENTO_SECRET = original

    // Rotating the secret should log you out, not silently keep you in.
    assert.equal(result.valid, false)
  })

  it("expires a token older than the idle window", async () => {
    const old = Date.now() - idleTimeoutMs() - 1000
    const result = await readSession(await issueSession(old))

    assert.deepEqual(result, { valid: false, reason: "expired" })
  })

  it("still accepts a token just inside the idle window", async () => {
    const recent = Date.now() - idleTimeoutMs() + 5000
    const result = await readSession(await issueSession(recent))

    assert.equal(result.valid, true)
  })

  it("distinguishes expired from invalid, so the lock screen can explain itself", async () => {
    const expired = await readSession(await issueSession(Date.now() - idleTimeoutMs() - 1))
    assert.equal(expired.valid === false && expired.reason, "expired")

    const garbage = await readSession("not-a-token")
    assert.equal(garbage.valid === false && garbage.reason, "invalid")
  })

  it("refuses a token issued in the future", async () => {
    const result = await readSession(await issueSession(Date.now() + 10 * 60_000))
    assert.deepEqual(result, { valid: false, reason: "invalid" })
  })
})

describe("idleTimeoutMs", () => {
  it("defaults to thirty minutes", () => {
    delete process.env.BENTO_LOCK_MINUTES
    assert.equal(idleTimeoutMs(), 30 * 60 * 1000)
  })

  it("reads a configured value", () => {
    process.env.BENTO_LOCK_MINUTES = "5"
    assert.equal(idleTimeoutMs(), 5 * 60 * 1000)
    delete process.env.BENTO_LOCK_MINUTES
  })

  it("falls back rather than trusting nonsense", () => {
    for (const bad of ["0", "-3", "abc", ""]) {
      process.env.BENTO_LOCK_MINUTES = bad
      assert.equal(idleTimeoutMs(), 30 * 60 * 1000, `${bad} should fall back`)
    }
    delete process.env.BENTO_LOCK_MINUTES
  })
})

describe("sessionCookieOptions", () => {
  it("is a session cookie, so closing the browser drops it", () => {
    const options = sessionCookieOptions(true) as Record<string, unknown>

    assert.equal("maxAge" in options, false, "a maxAge would outlive the browser session")
    assert.equal("expires" in options, false, "an expiry would outlive the browser session")
  })

  it("is httpOnly and same site, so script cannot read it and a cross site post cannot use it", () => {
    const options = sessionCookieOptions(true)

    assert.equal(options.httpOnly, true)
    assert.equal(options.sameSite, "lax")
    assert.equal(options.path, "/")
  })

  it("only sets secure when actually on https", () => {
    assert.equal(sessionCookieOptions(true).secure, true)
    assert.equal(sessionCookieOptions(false).secure, false)
  })
})

describe("configuration", () => {
  it("names its cookie", () => {
    assert.equal(SESSION_COOKIE, "bento_session")
  })

  it("throws a useful message when BENTO_USER is unset", () => {
    const original = process.env.BENTO_USER
    delete process.env.BENTO_USER

    assert.throws(() => username(), /BENTO_USER/)

    process.env.BENTO_USER = original
  })
})
