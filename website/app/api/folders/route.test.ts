import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { authed, setUpTestDatabase } from "~/lib/test-support"

await setUpTestDatabase()

const { GET, OPTIONS } = await import("./route.ts")
const { createFolder } = await import("~/lib/db/folders")


describe("GET /api/folders", () => {
  it("refuses a request with no bearer token", async () => {
    const res = await GET(new Request("http://x/api/folders"))
    assert.equal(res.status, 401)
  })

  it("refuses the wrong token", async () => {
    const res = await GET(new Request("http://x/api/folders", { headers: { authorization: "Bearer nope" } }))
    assert.equal(res.status, 401)
  })

  it("lists folders alphabetically once authenticated", async () => {
    await createFolder("Reading")
    await createFolder("Archive")

    const res = await GET(new Request("http://x/api/folders", authed()))
    assert.equal(res.status, 200)

    const body = (await res.json()) as { folders: { name: string }[] }
    assert.deepEqual(
      body.folders.map((f) => f.name),
      ["Archive", "Reading"]
    )
  })
})

describe("OPTIONS /api/folders", () => {
  it("answers the preflight and reflects the caller's origin", () => {
    const res = OPTIONS(
      new Request("http://x/api/folders", { method: "OPTIONS", headers: { origin: "chrome-extension://abc" } })
    )
    assert.equal(res.status, 204)
    assert.equal(res.headers.get("access-control-allow-origin"), "chrome-extension://abc")
  })
})
