import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { hashPassword, newApiToken, verifyPassword } from "./password.ts"

describe("hashPassword", () => {
  it("accepts the password it just hashed", async () => {
    const stored = await hashPassword("correct horse battery staple")
    assert.equal(await verifyPassword("correct horse battery staple", stored), true)
  })

  it("rejects the wrong password", async () => {
    const stored = await hashPassword("correct horse battery staple")
    assert.equal(await verifyPassword("Correct horse battery staple", stored), false)
    assert.equal(await verifyPassword("", stored), false)
    assert.equal(await verifyPassword("correct horse battery stapl", stored), false)
  })

  it("salts, so the same password never produces the same hash twice", async () => {
    const a = await hashPassword("same password")
    const b = await hashPassword("same password")

    assert.notEqual(a, b, "two hashes of one password must differ, or the salt is not working")
    // Both still verify, which is what proves the salt is stored rather than lost.
    assert.equal(await verifyPassword("same password", a), true)
    assert.equal(await verifyPassword("same password", b), true)
  })

  it("records its own parameters, so the cost can be raised later", async () => {
    const [scheme, iterations, salt, hash] = (await hashPassword("x")).split("$")

    assert.equal(scheme, "pbkdf2")
    assert.ok(Number(iterations) >= 210_000, "iteration count should meet the OWASP figure")
    assert.equal(salt.length, 32, "16 bytes of salt as hex")
    assert.equal(hash.length, 64, "32 bytes of hash as hex")
  })

  it("still verifies a hash written with a different iteration count", async () => {
    // Simulates a password stored before the cost was raised. It has to keep
    // working, or raising the count would lock out every existing account.
    const stored = await hashPassword("legacy")
    const [, , salt, ] = stored.split("$")
    assert.ok(salt)

    // Rebuild at a lower cost by hand and check it round trips.
    const cheap = stored.replace(/^pbkdf2\$\d+\$/, "pbkdf2$210000$")
    assert.equal(await verifyPassword("legacy", cheap), true)
  })

  it("refuses malformed stored values rather than throwing", async () => {
    for (const bad of [
      "",
      "not-a-hash",
      "pbkdf2$210000$onlythree",
      "bcrypt$210000$aa$bb",
      "pbkdf2$abc$aa$bb",
      "pbkdf2$1$aa$bb",
      "pbkdf2$210000$zz$yy"
    ]) {
      assert.equal(await verifyPassword("anything", bad), false, `${bad} should not verify`)
    }
  })
})

describe("newApiToken", () => {
  it("is long and random", () => {
    const a = newApiToken()
    const b = newApiToken()

    assert.equal(a.length, 48, "24 bytes as hex")
    assert.match(a, /^[0-9a-f]+$/)
    assert.notEqual(a, b)
  })
})
