import assert from "node:assert/strict"
import { existsSync, readdirSync } from "node:fs"
import { after, describe, it } from "node:test"

import { authed, cleanupDataDir, setUpTempDataDir } from "~/lib/test-support"

setUpTempDataDir()

const { POST, OPTIONS } = await import("./route.ts")
const { createFolder } = await import("~/lib/db/folders")
const { screenshotDir } = await import("~/lib/db/client")

after(cleanupDataDir)

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
    const res = await capture({ url: "https://example.com/c", folderId: "00000000-0000-0000-0000-000000000000" })
    const body = (await res.json()) as { bookmark: { folder_id: string | null }; folderWasStale: boolean }

    assert.equal(body.folderWasStale, true)
    assert.equal(body.bookmark.folder_id, null)
  })

  it("files into a folder that does exist", async () => {
    const folder = createFolder("Reading")
    assert.ok(folder.ok)

    const res = await capture({ url: "https://example.com/d", folderId: folder.ok ? folder.folder.id : "" })
    const body = (await res.json()) as { bookmark: { folder_id: string | null }; folderWasStale: boolean }

    assert.equal(body.folderWasStale, false)
    assert.equal(body.bookmark.folder_id, folder.ok ? folder.folder.id : null)
  })

  it("saves a screenshot to disk and returns an absolute url for it", async () => {
    const before = readdirSync(screenshotDir())

    const res = await capture({ url: "https://example.com/e", screenshot: jpegFile(1) })
    const body = (await res.json()) as { bookmark: { screenshot_url: string | null } }

    assert.ok(body.bookmark.screenshot_url?.startsWith("http://localhost:3000/api/screenshots/"))

    const after_ = readdirSync(screenshotDir())
    assert.equal(after_.length, before.length + 1)
  })

  it("deletes the old screenshot file when a recapture brings a new one", async () => {
    const first = await capture({ url: "https://example.com/f", screenshot: jpegFile(2) })
    const firstBody = (await first.json()) as { bookmark: { screenshot_url: string } }
    const firstFilename = firstBody.bookmark.screenshot_url.split("/").at(-1) as string

    assert.ok(existsSync(`${screenshotDir()}/${firstFilename}`), "first screenshot should exist right after capture")

    const second = await capture({ url: "https://example.com/f", screenshot: jpegFile(3) })
    const secondBody = (await second.json()) as { bookmark: { screenshot_url: string } }
    const secondFilename = secondBody.bookmark.screenshot_url.split("/").at(-1) as string

    assert.notEqual(secondFilename, firstFilename)
    assert.ok(existsSync(`${screenshotDir()}/${secondFilename}`), "second screenshot should exist")
    assert.ok(!existsSync(`${screenshotDir()}/${firstFilename}`), "first screenshot should have been deleted")
  })

  it("rejects a screenshot over the size cap", async () => {
    // The route caps at 3 * 1024 * 1024 (3,145,728) bytes, comfortably over it.
    const res = await capture({ url: "https://example.com/g", screenshot: jpegFile(4, 3_200_000) })
    assert.equal(res.status, 413)
  })
})

describe("OPTIONS /api/capture", () => {
  it("answers the preflight", () => {
    const res = OPTIONS(new Request("http://x/api/capture", { method: "OPTIONS", headers: { origin: "chrome-extension://abc" } }))
    assert.equal(res.status, 204)
    assert.equal(res.headers.get("access-control-allow-origin"), "chrome-extension://abc")
  })
})
