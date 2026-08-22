import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { authed, setUpTestDatabase } from "~/lib/test-support"

await setUpTestDatabase()

const { POST, OPTIONS } = await import("./route.ts")
const { createFolder } = await import("~/lib/db/folders")

function jpegFile(byte: number, size = 16): File {
  return new File([new Uint8Array(size).fill(byte)], "shot.jpg", { type: "image/jpeg" })
}

function capture(fields: Record<string, string | File>, init: RequestInit = authed()) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.set(key, value)

  return POST(new Request("http://x/api/capture", { ...init, method: "POST", body: form }))
}

describe("POST /api/capture", () => {
  it("refuses without a bearer token", async () => {
    const res = await capture({ url: "https://example.com" }, {})
    assert.equal(res.status, 401)
  })

  it("rejects an address that will not normalise", async () => {
    const res = await capture({ url: "javascript:alert(1)" })
    assert.equal(res.status, 400)
  })

  it("creates a new bookmark", async () => {
    const res = await capture({ url: "https://example.com/a", title: "A", tags: "react, ui" })
    assert.equal(res.status, 200)

    const body = (await res.json()) as { bookmark: { title: string; tags: string[] }; updated: boolean }
    assert.equal(body.updated, false)
    assert.equal(body.bookmark.title, "A")
    assert.deepEqual(body.bookmark.tags, ["react", "ui"])
  })

  it("merges a recapture of the same address: unions tags, keeps the old note", async () => {
    await capture({ url: "https://example.com/b", title: "B", tags: "one", notes: "keep me" })
    const res = await capture({ url: "https://example.com/b", title: "", tags: "two", notes: "" })

    const body = (await res.json()) as {
      bookmark: { title: string; tags: string[]; notes: string }
      updated: boolean
    }
    assert.equal(body.updated, true)
    assert.equal(body.bookmark.title, "B") // blank title on recapture keeps the old one
    assert.equal(body.bookmark.notes, "keep me") // blank note on recapture keeps the old one
    assert.deepEqual(body.bookmark.tags.sort(), ["one", "two"])
  })

  it("falls back to unfiled when the folder id does not exist, and says so", async () => {
    const res = await capture({
      url: "https://example.com/c",
      folderId: "00000000-0000-0000-0000-000000000000"
    })
    const body = (await res.json()) as { bookmark: { folder_id: string | null }; folderWasStale: boolean }

    assert.equal(body.folderWasStale, true)
    assert.equal(body.bookmark.folder_id, null)
  })

  it("files into a folder that does exist", async () => {
    const folder = await createFolder("Reading")
    assert.ok(folder.ok)

    const res = await capture({ url: "https://example.com/d", folderId: folder.ok ? folder.folder.id : "" })
    const body = (await res.json()) as { bookmark: { folder_id: string | null }; folderWasStale: boolean }

    assert.equal(body.folderWasStale, false)
    assert.equal(body.bookmark.folder_id, folder.ok ? folder.folder.id : null)
  })

  it("rejects a screenshot over the size cap before trying to upload it", async () => {
    // The cap is checked ahead of the blob store, so this holds whether or not
    // one is configured.
    const res = await capture({ url: "https://example.com/g", screenshot: jpegFile(4, 3_200_000) })
    assert.equal(res.status, 413)
  })

  it("still saves the capture when there is no blob store, just without a picture", async () => {
    // No BLOB_READ_WRITE_TOKEN in tests. Losing the whole bookmark because the
    // picture could not be stored would be the wrong trade, the frame already
    // has a designed state for having no screenshot.
    const res = await capture({ url: "https://example.com/h", title: "No store", screenshot: jpegFile(1) })

    assert.equal(res.status, 200)
    const body = (await res.json()) as { bookmark: { title: string; screenshot_url: string | null } }
    assert.equal(body.bookmark.title, "No store")
    assert.equal(body.bookmark.screenshot_url, null)
  })
})

describe("OPTIONS /api/capture", () => {
  it("answers the preflight", () => {
    const res = OPTIONS(
      new Request("http://x/api/capture", {
        method: "OPTIONS",
        headers: { origin: "chrome-extension://abc" }
      })
    )
    assert.equal(res.status, 204)
    assert.equal(res.headers.get("access-control-allow-origin"), "chrome-extension://abc")
  })
})
