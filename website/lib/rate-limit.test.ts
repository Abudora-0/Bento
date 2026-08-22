import assert from "node:assert/strict"
import { beforeEach, describe, it } from "node:test"

import { setUpTestDatabase } from "~/lib/test-support"

await setUpTestDatabase()

const {
  addressFrom,
  checkSignIn,
  checkSignUp,
  clearSignInFailures,
  describeWait,
  recordAttempt,
  signInBuckets,
  signUpBuckets
} = await import("./rate-limit.ts")

const { db } = await import("./db/client.ts")

const ADDRESS = "203.0.113.7"

async function wipe(): Promise<void> {
  await db().execute("delete from auth_attempts")
}

async function failSignIn(identifier: string, address: string, times: number): Promise<void> {
  for (let i = 0; i < times; i++) await recordAttempt(signInBuckets(identifier, address))
}

describe("addressFrom", () => {
  it("takes the leftmost x-forwarded-for entry, which is the original caller", () => {
    const headers = new Headers({ "x-forwarded-for": "198.51.100.4, 10.0.0.1, 10.0.0.2" })
    assert.equal(addressFrom(headers), "198.51.100.4")
  })

  it("falls back to x-real-ip", () => {
    assert.equal(addressFrom(new Headers({ "x-real-ip": "198.51.100.9" })), "198.51.100.9")
  })

  it("has a name for having no idea, rather than throwing or using empty string", () => {
    // Every attempt has to land in some bucket. An empty key would put every
    // unknown caller in the same one as an intentionally blank header, which
    // is fine, but it must be a real string so the index still works.
    assert.equal(addressFrom(new Headers()), "unknown")
    assert.equal(addressFrom(new Headers({ "x-forwarded-for": "   " })), "unknown")
  })
})

describe("checkSignIn", () => {
  beforeEach(wipe)

  it("allows a first attempt", async () => {
    assert.deepEqual(await checkSignIn("someone@example.com", ADDRESS), { ok: true })
  })

  it("still allows an attempt just under the per account limit", async () => {
    await failSignIn("someone@example.com", ADDRESS, 7)
    assert.equal((await checkSignIn("someone@example.com", ADDRESS)).ok, true)
  })

  it("refuses once the account has been missed too many times", async () => {
    await failSignIn("someone@example.com", ADDRESS, 8)

    const verdict = await checkSignIn("someone@example.com", ADDRESS)
    assert.equal(verdict.ok, false)
    assert.ok(verdict.ok === false && verdict.retryAfterMs > 0)
  })

  it("counts the account without regard to case, so changing capitals is not a way around it", async () => {
    await failSignIn("Someone@Example.com", ADDRESS, 8)
    assert.equal((await checkSignIn("someone@example.com", ADDRESS)).ok, false)
  })

  it("locks one account without locking another", async () => {
    await failSignIn("victim@example.com", ADDRESS, 8)

    assert.equal((await checkSignIn("victim@example.com", "198.51.100.1")).ok, false)
    assert.equal((await checkSignIn("bystander@example.com", "198.51.100.1")).ok, true)
  })

  it("refuses an address spraying many different accounts", async () => {
    // Under the per account limit for every single one of them, which is
    // exactly the shape the address bucket exists to catch.
    for (let i = 0; i < 26; i++) await failSignIn(`target-${i}@example.com`, ADDRESS, 1)

    assert.equal((await checkSignIn("target-99@example.com", ADDRESS)).ok, false)
    assert.equal((await checkSignIn("target-99@example.com", "198.51.100.2")).ok, true)
  })

  it("does not count attempts that have already aged out of the window", async () => {
    const old = Date.now() - 16 * 60 * 1000
    for (let i = 0; i < 20; i++) {
      await db().execute({
        sql: "insert into auth_attempts (id, bucket, at) values (?, ?, ?)",
        args: [`stale-${i}`, "id:aged@example.com", old]
      })
    }

    assert.equal((await checkSignIn("aged@example.com", ADDRESS)).ok, true)
  })

  it("reports a wait no longer than the window itself", async () => {
    await failSignIn("someone@example.com", ADDRESS, 8)

    const verdict = await checkSignIn("someone@example.com", ADDRESS)
    assert.ok(verdict.ok === false && verdict.retryAfterMs <= 15 * 60 * 1000)
  })
})

describe("the account key, which is what the bucket is really counting", () => {
  beforeEach(wipe)

  it("gives one account a single allowance whichever way its owner is named", async () => {
    /*
     * Sign in takes an email or a username in one field. Bucketing on the
     * string that was typed would hand the same account two separate
     * allowances to anybody who knows both, so the caller resolves the
     * identifier to a user id first and counts that.
     */
    const { createUser, findLoginCandidate } = await import("./db/users.ts")

    const made = await createUser("two-ways@example.com", "twoways", "a-real-password-here")
    assert.ok(made.ok)
    if (!made.ok) return

    const keyFor = async (identifier: string) =>
      (await findLoginCandidate(identifier))?.user.id ?? identifier

    assert.equal(await keyFor("two-ways@example.com"), made.user.id)
    assert.equal(await keyFor("twoways"), made.user.id)
    assert.equal(await keyFor("TwoWays"), made.user.id)

    // Four misses under the email and four under the username is eight, and
    // eight is the limit however they were spread.
    for (let i = 0; i < 4; i++) await recordAttempt(signInBuckets(await keyFor("two-ways@example.com"), ADDRESS))
    for (let i = 0; i < 4; i++) await recordAttempt(signInBuckets(await keyFor("twoways"), ADDRESS))

    assert.equal((await checkSignIn(await keyFor("twoways"), ADDRESS)).ok, false)
  })

  it("falls back to the typed string when it resolves to nobody", async () => {
    const { findLoginCandidate } = await import("./db/users.ts")
    assert.equal(await findLoginCandidate("nobody-at-all@example.com"), null)

    // Still counted, or an attacker could avoid the limiter entirely by
    // guessing at accounts that do not exist while probing which ones do.
    await failSignIn("nobody-at-all@example.com", ADDRESS, 8)
    assert.equal((await checkSignIn("nobody-at-all@example.com", ADDRESS)).ok, false)
  })
})

describe("clearSignInFailures", () => {
  beforeEach(wipe)

  it("lets someone back in after they finally get it right", async () => {
    await failSignIn("forgetful@example.com", ADDRESS, 8)
    assert.equal((await checkSignIn("forgetful@example.com", ADDRESS)).ok, false)

    await clearSignInFailures("forgetful@example.com")
    assert.equal((await checkSignIn("forgetful@example.com", ADDRESS)).ok, true)
  })

  it("does not clear the address bucket", async () => {
    // Guessing into one account must not reset the counter that is watching
    // this address work through everybody else's.
    for (let i = 0; i < 26; i++) await failSignIn(`target-${i}@example.com`, ADDRESS, 1)

    await clearSignInFailures("target-0@example.com")

    assert.equal((await checkSignIn("someone-else@example.com", ADDRESS)).ok, false)
  })
})

describe("checkSignUp", () => {
  beforeEach(wipe)

  it("allows the first few accounts from one address", async () => {
    for (let i = 0; i < 4; i++) await recordAttempt(signUpBuckets(ADDRESS))
    assert.equal((await checkSignUp(ADDRESS)).ok, true)
  })

  it("refuses once one address has made enough of them", async () => {
    for (let i = 0; i < 5; i++) await recordAttempt(signUpBuckets(ADDRESS))

    assert.equal((await checkSignUp(ADDRESS)).ok, false)
    assert.equal((await checkSignUp("198.51.100.3")).ok, true)
  })

  it("is counted separately from sign in failures", async () => {
    await failSignIn("someone@example.com", ADDRESS, 8)
    assert.equal((await checkSignUp(ADDRESS)).ok, true)
  })
})

describe("recordAttempt", () => {
  beforeEach(wipe)

  it("prunes rows that have aged out, so the table cannot grow without limit", async () => {
    await db().execute({
      sql: "insert into auth_attempts (id, bucket, at) values (?, ?, ?)",
      args: ["ancient", "id:old@example.com", Date.now() - 3 * 60 * 60 * 1000]
    })

    await recordAttempt(signInBuckets("fresh@example.com", ADDRESS))

    const { rows } = await db().execute("select count(*) as n from auth_attempts where id = 'ancient'")
    assert.equal(Number((rows[0] as Record<string, unknown>).n), 0)
  })

  it("writes one row per bucket named", async () => {
    await recordAttempt(signInBuckets("someone@example.com", ADDRESS))

    const { rows } = await db().execute("select count(*) as n from auth_attempts")
    assert.equal(Number((rows[0] as Record<string, unknown>).n), 2)
  })
})

describe("describeWait", () => {
  it("rounds up into something a person reads", () => {
    assert.equal(describeWait(1000), "in about a minute")
    assert.equal(describeWait(4 * 60_000), "in about 4 minutes")
    assert.equal(describeWait(90 * 60_000), "in about 2 hours")
    assert.equal(describeWait(60 * 60_000), "in about an hour")
  })
})
