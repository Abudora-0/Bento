import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { makeUser, setUpTestDatabase } from "~/lib/test-support"

await setUpTestDatabase()

const { unauthorized, userFromBearer } = await import("./auth.ts")

const user = await makeUser("bearer-auth@example.com")

function withHeader(value: string | null): Request {
  return new Request("http://x/api/folders", value === null ? {} : { headers: { authorization: value } })
}

describe("userFromBearer", () => {
  it("resolves a real token to its owner", async () => {
    const found = await userFromBearer(withHeader(`Bearer ${user.api_token}`))
    assert.equal(found?.id, user.id)
  })

  it("tolerates trailing whitespace, which a copy and paste often carries", async () => {
    const found = await userFromBearer(withHeader(`Bearer ${user.api_token}   `))
    assert.equal(found?.id, user.id)
  })

  it("refuses a token nobody was issued", async () => {
    assert.equal(await userFromBearer(withHeader("Bearer 00000000")), null)
  })

  it("refuses a missing header", async () => {
    assert.equal(await userFromBearer(withHeader(null)), null)
  })

  it("refuses anything that is not a Bearer scheme", async () => {
    for (const header of ["", user.api_token, `Basic ${user.api_token}`, `bearer${user.api_token}`, "Bearer"]) {
      assert.equal(await userFromBearer(withHeader(header)), null, `${JSON.stringify(header)} should not authenticate`)
    }
  })

  it("does not treat an empty token as a match for anything", async () => {
    // A row could in principle hold an empty api_token if something upstream
    // went wrong. "Bearer " with nothing after it must still be nobody.
    assert.equal(await userFromBearer(withHeader("Bearer ")), null)
  })

  it("never hands back the password hash", async () => {
    const found = await userFromBearer(withHeader(`Bearer ${user.api_token}`))
    assert.ok(found)
    assert.equal("password_hash" in (found as object), false)
  })
})

describe("unauthorized", () => {
  it("is a 401 that says nothing useful about why", async () => {
    const response = unauthorized(new Request("http://x/api/folders"))

    assert.equal(response.status, 401)
    const body = (await response.json()) as { error: string }
    assert.match(body.error, /token/i)
  })

  it("still carries CORS headers, or the extension never sees the 401", () => {
    // A response the browser blocks looks like a network failure to the popup,
    // which is a much worse error message than "check your token".
    const response = unauthorized(
      new Request("http://x/api/folders", { headers: { origin: "chrome-extension://abc" } })
    )

    assert.equal(response.headers.get("access-control-allow-origin"), "chrome-extension://abc")
  })
})
