import assert from "node:assert/strict"
import { describe, it } from "node:test"

// The session module reads BENTO_SECRET when it signs, so the environment has
// to exist before anything is imported. No database is involved at all here,
// these are pure functions over a string.
process.env.BENTO_SECRET = "session-test-secret-please-ignore"

const { SESSION_COOKIE, idleTimeoutMs, issueSession, readSession, sessionCookieOptions } =
  await import("./session.ts")

const USER = "11111111-1111-1111-1111-111111111111"

describe("issueSession and readSession", () => {
  it("accepts a token it just issued, and says who it belongs to", async () => {
    const result = await readSession(await issueSession(USER))

    assert.equal(result.valid, true)
    assert.equal(result.valid === true && result.userId, USER)
  })

  it("rejects a missing token", async () => {
    assert.deepEqual(await readSession(undefined), { valid: false, reason: "invalid" })
  })

  it("rejects an empty or malformed token", async () => {
    for (const bad of ["", "nodot", "a.b.c.d", ".", "..", "!!!.???"]) {
      const result = await readSession(bad)
      assert.equal(result.valid, false, `${JSON.stringify(bad)} should not verify`)
    }
  })

  it("rejects a payload that is signed but not valid json", async () => {
    // A signature over garbage is still a signature, so the parse has to be
    // guarded rather than trusted just because the HMAC checked out.
    const result = await readSession("bm90LWpzb24.AAAA")
    assert.equal(result.valid, false)
  })

  it("rejects a tampered payload, which is the attack the HMAC exists to stop", async () => {
    const token = await issueSession(USER)
    const [, signature] = token.split(".")

    const forged = `${Buffer.from(JSON.stringify({ u: "someone-else", t: Date.now() })).toString("base64url")}.${signature}`

    assert.notEqual(forged, token)
    assert.equal((await readSession(forged)).valid, false, "must not be able to swap the user id")
  })

  it("rejects a tampered signature", async () => {
    const [payload] = (await issueSession(USER)).split(".")
    const result = await readSession(`${payload}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`)
    assert.equal(result.valid, false)
  })

  it("rejects a token signed with a different secret", async () => {
    const token = await issueSession(USER)

    const original = process.env.BENTO_SECRET
    process.env.BENTO_SECRET = "a-completely-different-secret"
    const result = await readSession(token)
    process.env.BENTO_SECRET = original

    // Rotating the secret should sign everybody out, not silently keep them in.
    assert.equal(result.valid, false)
  })

  it("expires a token older than the idle window", async () => {
    const old = Date.now() - idleTimeoutMs() - 1000
    assert.deepEqual(await readSession(await issueSession(USER, { issuedAt: old })), {
      valid: false,
      reason: "expired"
    })
  })

  it("still accepts a token just inside the idle window", async () => {
    const recent = Date.now() - idleTimeoutMs() + 5000
    assert.equal((await readSession(await issueSession(USER, { issuedAt: recent }))).valid, true)
  })

  it("expires a remembered session too, so remembering is not the same as never locking", async () => {
    const old = Date.now() - idleTimeoutMs() - 1000
    const token = await issueSession(USER, { remember: true, issuedAt: old })

    assert.deepEqual(await readSession(token), { valid: false, reason: "expired" })
  })

  it("carries the remember flag through so middleware can preserve it", async () => {
    const plain = await readSession(await issueSession(USER))
    const remembered = await readSession(await issueSession(USER, { remember: true }))

    assert.equal(plain.valid === true && plain.remember, false)
    assert.equal(remembered.valid === true && remembered.remember, true)
  })

  it("distinguishes expired from invalid, so the lock screen can explain itself", async () => {
    const expired = await readSession(await issueSession(USER, { issuedAt: Date.now() - idleTimeoutMs() - 1 }))
    assert.equal(expired.valid === false && expired.reason, "expired")

    const garbage = await readSession("not-a-token")
    assert.equal(garbage.valid === false && garbage.reason, "invalid")
  })

  it("refuses a token issued in the future", async () => {
    const result = await readSession(await issueSession(USER, { issuedAt: Date.now() + 10 * 60_000 }))
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
  it("dies with the browser unless remembering was asked for", () => {
    const plain = sessionCookieOptions(true) as Record<string, unknown>

    assert.equal("maxAge" in plain, false, "a maxAge would outlive the browser session")
    assert.equal("expires" in plain, false)
  })

  it("gets a lifetime when remembering", () => {
    const remembered = sessionCookieOptions(true, true) as Record<string, unknown>

    assert.equal(typeof remembered.maxAge, "number")
    assert.ok((remembered.maxAge as number) > 24 * 60 * 60, "should outlast a day")
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
})
