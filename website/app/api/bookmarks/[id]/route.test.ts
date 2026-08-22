import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { authed, makeUser, setUpTestDatabase } from "~/lib/test-support"

await setUpTestDatabase()

const { PATCH } = await import("./route.ts")
const { upsertByUrl } = await import("~/lib/db/bookmarks")

const user = await makeUser("star@example.com")


function patch(id: string, body: unknown, init: RequestInit = authed(user.api_token)) {
  return PATCH(
    new Request(`http://x/api/bookmarks/${id}`, {
      ...init,
      method: "PATCH",
      headers: { ...init.headers, "content-type": "application/json" },
      body: JSON.stringify(body)
    }),
    { params: Promise.resolve({ id }) }
  )
}

describe("PATCH /api/bookmarks/[id]", () => {
  it("refuses without a bearer token", async () => {
    const res = await patch("whatever", { starred: true }, {})
    assert.equal(res.status, 401)
  })

  it("stars an existing bookmark", async () => {
    const { bookmark } = await upsertByUrl(user.id, {
      url: "https://example.com/star-me",
      title: "Star me",
      faviconUrl: null,
      screenshotUrl: null,
      tags: [],
      notes: "",
      folderId: null
    })

    const res = await patch(bookmark.id, { starred: true })
    assert.equal(res.status, 200)

    const body = (await res.json()) as { bookmark: { starred: boolean } }
    assert.equal(body.bookmark.starred, true)
  })

  it("rejects a body that is not { starred: boolean }", async () => {
    const res = await patch("some-id", { starred: "yes" })
    assert.equal(res.status, 400)
  })

  it("404s on an id that does not exist", async () => {
    const res = await patch("00000000-0000-0000-0000-000000000000", { starred: true })
    assert.equal(res.status, 404)
  })
})
