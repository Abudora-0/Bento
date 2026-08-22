import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { authed, makeUser, setUpTestDatabase } from "~/lib/test-support"

await setUpTestDatabase()

const { GET } = await import("./route.ts")
const { upsertByUrl } = await import("~/lib/db/bookmarks")

const user = await makeUser("recent@example.com")


describe("GET /api/bookmarks", () => {
  it("refuses without a bearer token", async () => {
    const res = await GET(new Request("http://x/api/bookmarks"))
    assert.equal(res.status, 401)
  })

  it("returns the newest captures first, plus a total count", async () => {
    for (let i = 0; i < 3; i++) {
      await upsertByUrl(user.id, {
        url: `https://example.com/${i}`,
        title: `Page ${i}`,
        faviconUrl: null,
        screenshotUrl: null,
        tags: [],
        notes: "",
        folderId: null
      })
    }

    const res = await GET(new Request("http://x/api/bookmarks?limit=2", authed(user.api_token)))
    assert.equal(res.status, 200)

    const body = (await res.json()) as { bookmarks: { url: string }[]; total: number }
    assert.equal(body.total, 3)
    assert.equal(body.bookmarks.length, 2)
    assert.equal(body.bookmarks[0].url, "https://example.com/2")
  })

  it("clamps an absurd limit rather than erroring", async () => {
    const res = await GET(new Request("http://x/api/bookmarks?limit=99999", authed(user.api_token)))
    const body = (await res.json()) as { bookmarks: unknown[] }
    assert.ok(body.bookmarks.length <= 50)
  })
})
