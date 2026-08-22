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
  normalizeUsername,
  passwordEchoesCredentials,
  regenerateApiToken,
  validateCredentials,
  validateUsername,
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

describe("validateUsername", () => {
  it("accepts ordinary names", () => {
    for (const good of ["abu", "Abudora-0", "some_one", "a.b.c", "x".repeat(24), "123"]) {
      assert.equal(validateUsername(good), null, `${good} should be accepted`)
    }
  })

  it("has a floor and a ceiling", () => {
    assert.notEqual(validateUsername("ab"), null)
    assert.notEqual(validateUsername("x".repeat(25)), null)
  })

  it("refuses anything that could be mistaken for an email", () => {
    // Sign in takes one field for both, so this is what keeps the lookup
    // unambiguous rather than a nicety.
    assert.notEqual(validateUsername("someone@example.com"), null)
    assert.notEqual(validateUsername("a@b"), null)
  })

  it("refuses spaces, punctuation and anything exotic", () => {
    for (const bad of ["two words", "semi;colon", "slash/es", "emoji-🎞", "quote'd", "back\\slash", "plus+one"]) {
      assert.notEqual(validateUsername(bad), null, `${JSON.stringify(bad)} should be rejected`)
    }
  })

  it("wants a letter or number first, so a name cannot lead with punctuation", () => {
    assert.notEqual(validateUsername("-leading"), null)
    assert.notEqual(validateUsername(".hidden"), null)
    assert.notEqual(validateUsername("_under"), null)
    assert.equal(validateUsername("a-trailing-"), null)
  })

  it("refuses a name that is only whitespace", () => {
    assert.notEqual(validateUsername("     "), null)
  })
})

describe("passwordEchoesCredentials", () => {
  it("catches a password that is just the username or the email", () => {
    assert.equal(passwordEchoesCredentials("abudora", "me@example.com", "Abudora"), true)
    assert.equal(passwordEchoesCredentials("ME@EXAMPLE.COM", "me@example.com", "abudora"), true)
    assert.equal(passwordEchoesCredentials("me", "me@example.com", "abudora"), true)
  })

  it("leaves an ordinary password alone", () => {
    assert.equal(passwordEchoesCredentials(PASSWORD, "me@example.com", "abudora"), false)
  })
})

describe("normalising", () => {
  it("lowercases the email, so lookup and storage cannot disagree", () => {
    assert.equal(normalizeEmail("  Someone@Example.COM "), "someone@example.com")
  })

  it("keeps the capitals in a username, and only trims it", () => {
    // Displayed as typed, matched without case. Lowercasing here would take
    // away the one part of the name the person actually chose.
    assert.equal(normalizeUsername("  Abudora-0  "), "Abudora-0")
  })
})

describe("createUser", () => {
  it("creates an account and hands back a token for the extension", async () => {
    const result = await createUser("first@example.com", "first", PASSWORD)
    assert.ok(result.ok)

    if (!result.ok) return
    assert.equal(result.user.email, "first@example.com")
    assert.equal(result.user.username, "first")
    assert.match(result.user.api_token, /^[0-9a-f]{48}$/)
    assert.ok(result.user.id.length > 0)
  })

  it("never returns the password hash in the user object", async () => {
    const result = await createUser("nohash@example.com", "nohash", PASSWORD)
    assert.ok(result.ok)

    if (!result.ok) return
    assert.equal("password_hash" in result.user, false)
  })

  it("stores the email lowercased and the username as typed", async () => {
    const result = await createUser("  MiXeD@Example.COM  ", "  MiXeDCase  ", PASSWORD)
    assert.ok(result.ok)

    if (!result.ok) return
    assert.equal(result.user.email, "mixed@example.com")
    assert.equal(result.user.username, "MiXeDCase")
  })

  it("refuses a second account on the same email, whatever the capitalisation", async () => {
    await createUser("dupe@example.com", "dupeone", PASSWORD)
    const again = await createUser("DUPE@example.com", "dupetwo", PASSWORD)

    assert.equal(again.ok, false)
    assert.match(again.ok === false ? again.error : "", /already an account/i)
  })

  it("refuses a taken username, whatever the capitalisation, and says which field", async () => {
    await createUser("name-one@example.com", "TakenName", PASSWORD)
    const again = await createUser("name-two@example.com", "takenname", PASSWORD)

    assert.equal(again.ok, false)
    assert.match(again.ok === false ? again.error : "", /username is taken/i)
  })

  it("refuses a bad username before writing anything", async () => {
    const before = await countUsers()

    assert.equal((await createUser("bad-name@example.com", "no", PASSWORD)).ok, false)
    assert.equal((await createUser("bad-name@example.com", "has space", PASSWORD)).ok, false)

    assert.equal(await countUsers(), before)
  })

  it("refuses bad credentials before writing anything", async () => {
    const before = await countUsers()

    assert.equal((await createUser("not-an-email", "fine", PASSWORD)).ok, false)
    assert.equal((await createUser("fine@example.com", "fine", "tiny")).ok, false)

    assert.equal(await countUsers(), before)
  })

  it("refuses a password that is just the username", async () => {
    const result = await createUser("echo@example.com", "echoingname", "echoingname")

    assert.equal(result.ok, false)
    assert.match(result.ok === false ? result.error : "", /not your username or your email/i)
  })

  it("gives every account a different token", async () => {
    const a = await createUser("tok-a@example.com", "toka", PASSWORD)
    const b = await createUser("tok-b@example.com", "tokb", PASSWORD)

    assert.ok(a.ok && b.ok)
    assert.notEqual(a.ok && a.user.api_token, b.ok && b.user.api_token)
  })
})

describe("verifyLogin", () => {
  it("accepts the right password given the email", async () => {
    await createUser("login@example.com", "loginname", PASSWORD)
    const user = await verifyLogin("login@example.com", PASSWORD)

    assert.ok(user)
    assert.equal(user?.email, "login@example.com")
  })

  it("accepts the same password given the username instead", async () => {
    const user = await verifyLogin("loginname", PASSWORD)

    assert.ok(user)
    assert.equal(user?.email, "login@example.com")
  })

  it("does not care about capitalisation in either", async () => {
    assert.ok(await verifyLogin("  LOGIN@Example.com ", PASSWORD))
    assert.ok(await verifyLogin("  LoGiNnAmE ", PASSWORD))
  })

  it("rejects the wrong password", async () => {
    await createUser("wrongpw@example.com", "wrongpw", PASSWORD)
    assert.equal(await verifyLogin("wrongpw@example.com", "not-the-password"), null)
    assert.equal(await verifyLogin("wrongpw", "not-the-password"), null)
  })

  it("rejects an identifier nobody registered", async () => {
    assert.equal(await verifyLogin("ghost@example.com", PASSWORD), null)
    assert.equal(await verifyLogin("ghost", PASSWORD), null)
  })

  it("does not let one account's username reach another's password", async () => {
    // The lookup is "email = ? or username = ?", and both arguments come from
    // the same field. If those were ever crossed, signing in as one person
    // with another person's password would work.
    await createUser("alpha@example.com", "betaname", PASSWORD)
    await createUser("beta@example.com", "alphaname", "a-different-password")

    const found = await verifyLogin("betaname", PASSWORD)
    assert.equal(found?.email, "alpha@example.com")

    assert.equal(await verifyLogin("betaname", "a-different-password"), null)
  })

  it("takes about as long for an unknown account as for a wrong password", async () => {
    // The point of the dummy hash. If an unknown identifier returned instantly,
    // the response time would say which half of the guess was wrong.
    await createUser("timing@example.com", "timing", PASSWORD)

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
    const created = await createUser("bearer@example.com", "bearer", PASSWORD)
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
    const created = await createUser("rotate@example.com", "rotate", PASSWORD)
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
    const created = await createUser("keeppw@example.com", "keeppw", PASSWORD)
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
    const created = await createUser("byid@example.com", "byid", PASSWORD)
    assert.ok(created.ok)
    if (!created.ok) return

    assert.equal((await findUserById(created.user.id))?.email, "byid@example.com")
    assert.equal(await findUserById("00000000-0000-0000-0000-000000000000"), null)
  })
})
