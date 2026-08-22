import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { setUpTestDatabase } from "~/lib/test-support"

await setUpTestDatabase()

const { loadTray, upsertByUrl, setStarred, deleteBookmark, countBookmarks } = await import("./bookmarks.ts")
const { createFolder } = await import("./folders.ts")

const base = {
  title: "",
  faviconUrl: null,
  screenshotUrl: null,
  tags: [] as string[],
  notes: "",
  folderId: null as string | null
}

const listing = {
  sortColumn: "created_at" as const,
  ascending: false,
  limit: 36,
  offset: 0
}

describe("upsertByUrl, screenshot replacement", () => {
  it("reports the screenshot it replaced, so the caller can delete it", async () => {
    await upsertByUrl({ ...base, url: "https://shots.example.com/a", screenshotUrl: "https://blob/one.jpg" })

    const second = await upsertByUrl({
      ...base,
      url: "https://shots.example.com/a",
      screenshotUrl: "https://blob/two.jpg"
    })

    assert.equal(second.updated, true)
    assert.equal(second.replacedScreenshotUrl, "https://blob/one.jpg")
    assert.equal(second.bookmark.screenshot_url, "https://blob/two.jpg")
  })

  it("reports nothing on a first capture, there is no old file", async () => {
    const first = await upsertByUrl({
      ...base,
      url: "https://shots.example.com/b",
      screenshotUrl: "https://blob/new.jpg"
    })

    assert.equal(first.updated, false)
    assert.equal(first.replacedScreenshotUrl, null)
  })

  it("keeps the existing picture when a recapture brings none, and reports nothing", async () => {
    await upsertByUrl({ ...base, url: "https://shots.example.com/c", screenshotUrl: "https://blob/keep.jpg" })
    const again = await upsertByUrl({ ...base, url: "https://shots.example.com/c" })

    assert.equal(again.replacedScreenshotUrl, null, "nothing was replaced, so nothing should be deleted")
    assert.equal(again.bookmark.screenshot_url, "https://blob/keep.jpg")
  })

  it("reports nothing when the same picture is sent twice", async () => {
    await upsertByUrl({ ...base, url: "https://shots.example.com/d", screenshotUrl: "https://blob/same.jpg" })
    const again = await upsertByUrl({
      ...base,
      url: "https://shots.example.com/d",
      screenshotUrl: "https://blob/same.jpg"
    })

    // Deleting it would orphan the row's own picture.
    assert.equal(again.replacedScreenshotUrl, null)
  })
})

describe("upsertByUrl, merging", () => {
  it("unions tags rather than overwriting them", async () => {
    await upsertByUrl({ ...base, url: "https://merge.example.com/a", tags: ["one", "two"] })
    const again = await upsertByUrl({ ...base, url: "https://merge.example.com/a", tags: ["two", "three"] })

    assert.deepEqual(again.bookmark.tags.sort(), ["one", "three", "two"])
  })

  it("keeps the existing note unless a new one is supplied", async () => {
    await upsertByUrl({ ...base, url: "https://merge.example.com/b", notes: "original" })

    const blank = await upsertByUrl({ ...base, url: "https://merge.example.com/b", notes: "   " })
    assert.equal(blank.bookmark.notes, "original")

    const replaced = await upsertByUrl({ ...base, url: "https://merge.example.com/b", notes: "newer" })
    assert.equal(replaced.bookmark.notes, "newer")
  })

  it("does not drag a filed bookmark back out when the picker says unfiled", async () => {
    const folder = await createFolder("Filed")
    assert.ok(folder.ok)
    const folderId = folder.ok ? folder.folder.id : null

    await upsertByUrl({ ...base, url: "https://merge.example.com/c", folderId })
    const again = await upsertByUrl({ ...base, url: "https://merge.example.com/c", folderId: null })

    assert.equal(again.bookmark.folder_id, folderId)
  })

  it("never duplicates a url", async () => {
    const before = await countBookmarks()
    await upsertByUrl({ ...base, url: "https://merge.example.com/d" })
    await upsertByUrl({ ...base, url: "https://merge.example.com/d" })
    const after = await countBookmarks()

    assert.equal(after - before, 1)
  })
})

describe("loadTray", () => {
  it("returns rows, total, folders and tags in one call", async () => {
    const tray = await loadTray(listing)

    assert.ok(Array.isArray(tray.rows))
    assert.ok(Array.isArray(tray.folders))
    assert.ok(Array.isArray(tray.allTags))
    assert.equal(typeof tray.total, "number")
  })

  it("filters by tag through json_each, not a substring match", async () => {
    await upsertByUrl({ ...base, url: "https://tags.example.com/a", tags: ["react"] })
    await upsertByUrl({ ...base, url: "https://tags.example.com/b", tags: ["reactive"] })

    const tray = await loadTray({ ...listing, tag: "react" })
    const urls = tray.rows.map((r) => r.url)

    assert.ok(urls.includes("https://tags.example.com/a"))
    assert.ok(!urls.includes("https://tags.example.com/b"), "reactive is a different tag, not a match")
  })

  it("treats a percent in a search term as a literal", async () => {
    await upsertByUrl({ ...base, url: "https://search.example.com/a", title: "50% off sale" })
    await upsertByUrl({ ...base, url: "https://search.example.com/b", title: "nothing special" })

    const tray = await loadTray({ ...listing, q: "50% off" })

    assert.equal(tray.total, 1)
    assert.equal(tray.rows[0].url, "https://search.example.com/a")
  })

  it("narrows to starred only", async () => {
    const created = await upsertByUrl({ ...base, url: "https://starred.example.com/a" })
    await setStarred(created.bookmark.id, true)

    const tray = await loadTray({ ...listing, starredOnly: true })

    assert.ok(tray.total >= 1)
    assert.ok(tray.rows.every((r) => r.starred))
  })

  it("finds unfiled bookmarks with the none folder", async () => {
    const tray = await loadTray({ ...listing, folder: "none" })
    assert.ok(tray.rows.every((r) => r.folder_id === null))
  })

  it("counts the whole match, not just the page", async () => {
    const paged = await loadTray({ ...listing, limit: 1, offset: 0 })

    assert.equal(paged.rows.length, 1)
    assert.ok(paged.total > 1, "total should describe every match, not the page size")
  })
})

describe("deleteBookmark", () => {
  it("hands back the screenshot url so the caller can clean it up", async () => {
    const created = await upsertByUrl({
      ...base,
      url: "https://gone.example.com/a",
      screenshotUrl: "https://blob/doomed.jpg"
    })

    const url = await deleteBookmark(created.bookmark.id)
    assert.equal(url, "https://blob/doomed.jpg")
  })

  it("returns null for a bookmark that is not there", async () => {
    assert.equal(await deleteBookmark("00000000-0000-0000-0000-000000000000"), null)
  })
})
