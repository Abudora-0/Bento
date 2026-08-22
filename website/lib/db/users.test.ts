import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { setUpTestDatabase } from "~/lib/test-support"

await setUpTestDatabase()

const {
  countUsers,
  createUser,
  findUserByApiToken,
  findUserById,
  normalizeEmail,
  regenerateApiToken,
  validateCredentials,
  verifyLogin
} = await import("./users.ts")

const PASSWORD = "correct-horse-battery"

describe("validateCredentials", () => {
  it("wants something that looks like an email", () => {
    for (const bad of ["", "nope", "no@domain", "two@@at.com", "spaces in@it.com", "@nothing.com"]) {
      assert.notEqual(validateCredentials(bad, PASSWORD), null, `${JSON.stringify(bad)} should be rejected`)
    }
    assert.equal(validateCredentials("someone@example.com", PASSWORD), null)
  })

  it("sets a floor on the password rather than trusting the browser to", () => {
    assert.notEqual(validateCredentials("a@b.com", "short"), null)
    assert.notEqual(validateCredentials("a@b.com", "123456789"), null)
    assert.equal(validateCredentials("a@b.com", "1234567890"), null)
  })

  it("sets a ceiling too, since every character costs PBKDF2 time", () => {
    assert.notEqual(validateCredentials("a@b.com", "x".repeat(201)), null)
    assert.equal(validateCredentials("a@b.com", "x".repeat(200)), null)
  })
})

describe("normalizeEmail", () => {
  it("trims and lowercases, so storage and lookup can never disagree", () => {
    assert.equal(normalizeEmail("  Someone@Example.COM "), "someone@example.com")
  })
})

describe("createUser", () => {
  it("creates an account and hands back a token for the extension", async () => {
    const result = await createUser("first@example.com", PASSWORD)
    assert.ok(result.ok)

    if (!result.ok) return
    assert.equal(result.user.email, "first@example.com")
    assert.match(result.user.api_token, /^[0-9a-f]{48}$/)
    assert.ok(result.user.id.length > 0)
  })

  it("never returns the password hash in the user object", async () => {
    const result = await createUser("nohash@example.com", PASSWORD)
    assert.ok(result.ok)

    if (!result.ok) return
    assert.equal("password_hash" in result.user, false)
  })

  it("stores the email normalised", async () => {
    const result = await createUser("  MiXeD@Example.COM  ", PASSWORD)
    assert.ok(result.ok)
    assert.equal(result.ok && result.user.email, "mixed@example.com")
  })

  it("refuses a second account on the same email, whatever the capitalisation", async () => {
    await createUser("dupe@example.com", PASSWORD)
    const again = await createUser("DUPE@example.com", PASSWORD)

    assert.equal(again.ok, false)
    assert.match(again.ok === false ? again.error : "", /already an account/i)
  })

  it("refuses bad credentials before writing anything", async () => {
    const before = await countUsers()

    assert.equal((await createUser("not-an-email", PASSWORD)).ok, false)
    assert.equal((await createUser("fine@example.com", "tiny")).ok, false)

    assert.equal(await countUsers(), before)
  })

  it("gives every account a different token", async () => {
    const a = await createUser("tok-a@example.com", PASSWORD)
    const b = await createUser("tok-b@example.com", PASSWORD)

    assert.ok(a.ok && b.ok)
    assert.notEqual(a.ok && a.user.api_token, b.ok && b.user.api_token)
  })
})

describe("verifyLogin", () => {
  it("accepts the right password", async () => {
    await createUser("login@example.com", PASSWORD)
    const user = await verifyLogin("login@example.com", PASSWORD)

    assert.ok(user)
    assert.equal(user?.email, "login@example.com")
  })

  it("accepts a differently capitalised email, because that is not a secret", async () => {
    await createUser("case@example.com", PASSWORD)
    assert.ok(await verifyLogin("  CASE@Example.com ", PASSWORD))
  })

  it("rejects the wrong password", async () => {
    await createUser("wrongpw@example.com", PASSWORD)
    assert.equal(await verifyLogin("wrongpw@example.com", "not-the-password"), null)
  })

  it("rejects an email nobody registered", async () => {
    assert.equal(await verifyLogin("ghost@example.com", PASSWORD), null)
  })

  it("takes about as long for an unknown email as for a wrong password", async () => {
    // The point of the dummy hash. If an unknown email returned instantly, the
    // response time would say which half of the guess was wrong.
    await createUser("timing@example.com", PASSWORD)

    const startKnown = performance.now()
    await verifyLogin("timing@example.com", "wrong-password-here")
    const known = performance.now() - startKnown

    const startUnknown = performance.now()
    await verifyLogin("nobody-at-all@example.com", "wrong-password-here")
    const unknown = performance.now() - startUnknown

    // Generous bounds. This is checking that a hash ran at all, not that the
    // two paths are identical to the microsecond.
    assert.ok(unknown > known / 4, `unknown ${unknown.toFixed(0)}ms vs known ${known.toFixed(0)}ms`)
  })
})

describe("findUserByApiToken", () => {
  it("resolves the extension's bearer token to its owner", async () => {
    const created = await createUser("bearer@example.com", PASSWORD)
    assert.ok(created.ok)
    if (!created.ok) return

    const found = await findUserByApiToken(created.user.api_token)
    assert.equal(found?.id, created.user.id)
  })

  it("resolves nothing for a token that was never issued", async () => {
    assert.equal(await findUserByApiToken("deadbeef".repeat(6)), null)
    assert.equal(await findUserByApiToken(""), null)
  })
})

describe("regenerateApiToken", () => {
  it("replaces the token, and the old one stops working immediately", async () => {
    const created = await createUser("rotate@example.com", PASSWORD)
    assert.ok(created.ok)
    if (!created.ok) return

    const old = created.user.api_token
    const fresh = await regenerateApiToken(created.user.id)

    assert.ok(fresh)
    assert.notEqual(fresh, old)
    assert.equal(await findUserByApiToken(old), null, "the leaked token must be dead")
    assert.equal((await findUserByApiToken(fresh as string))?.id, created.user.id)
  })

  it("leaves the password alone, so rotating a token does not sign you out", async () => {
    const created = await createUser("keeppw@example.com", PASSWORD)
    assert.ok(created.ok)
    if (!created.ok) return

    await regenerateApiToken(created.user.id)
    assert.ok(await verifyLogin("keeppw@example.com", PASSWORD))
  })

  it("reports nothing for an id that does not exist", async () => {
    assert.equal(await regenerateApiToken("00000000-0000-0000-0000-000000000000"), null)
  })
})

describe("findUserById", () => {
  it("finds one, and does not invent one", async () => {
    const created = await createUser("byid@example.com", PASSWORD)
    assert.ok(created.ok)
    if (!created.ok) return

    assert.equal((await findUserById(created.user.id))?.email, "byid@example.com")
    assert.equal(await findUserById("00000000-0000-0000-0000-000000000000"), null)
  })
})
