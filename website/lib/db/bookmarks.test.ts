import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { makeUser, setUpTestDatabase } from "~/lib/test-support"

await setUpTestDatabase()

const { loadTray, upsertByUrl, setStarred, deleteBookmark, countBookmarks, getBookmark, editBookmark } =
  await import("./bookmarks.ts")
const { createFolder, listFolders, renameFolder, deleteFolder } = await import("./folders.ts")

const alice = await makeUser("alice@example.com")
const bob = await makeUser("bob@example.com")

const base = {
  title: "",
  faviconUrl: null,
  screenshotUrl: null,
  tags: [] as string[],
  notes: "",
  folderId: null as string | null
}

const listing = { sortColumn: "created_at" as const, ascending: false, limit: 36, offset: 0 }

/* -------------------------------------------------------------------------- */
/* Isolation. The whole point of the multi user change.                        */
/* -------------------------------------------------------------------------- */

describe("one account cannot reach another's rows", () => {
  it("keeps sheets separate even for the same url", async () => {
    await upsertByUrl(alice.id, { ...base, url: "https://shared.example.com/", title: "Alice's copy" })
    await upsertByUrl(bob.id, { ...base, url: "https://shared.example.com/", title: "Bob's copy" })

    const aliceTray = await loadTray(alice.id, listing)
    const bobTray = await loadTray(bob.id, listing)

    assert.equal(aliceTray.total, 1)
    assert.equal(bobTray.total, 1)
    assert.equal(aliceTray.rows[0].title, "Alice's copy")
    assert.equal(bobTray.rows[0].title, "Bob's copy")
  })

  it("will not read a bookmark by id across accounts", async () => {
    const mine = await upsertByUrl(alice.id, { ...base, url: "https://private.example.com/a" })

    assert.ok(await getBookmark(alice.id, mine.bookmark.id))
    assert.equal(await getBookmark(bob.id, mine.bookmark.id), null, "bob must not read alice's row")
  })

  it("will not star, edit or delete across accounts", async () => {
    const mine = await upsertByUrl(alice.id, { ...base, url: "https://private.example.com/b" })

    assert.equal(await setStarred(bob.id, mine.bookmark.id, true), false)
    assert.equal(await editBookmark(bob.id, mine.bookmark.id, { title: "hijacked", notes: "", tags: [], folderId: null }), null)
    assert.equal(await deleteBookmark(bob.id, mine.bookmark.id), null)

    // Still there, still untouched.
    const after = await getBookmark(alice.id, mine.bookmark.id)
    assert.ok(after)
    assert.notEqual(after?.title, "hijacked")
    assert.equal(after?.starred, false)
  })

  it("counts only your own", async () => {
    const aliceCount = await countBookmarks(alice.id)
    const bobCount = await countBookmarks(bob.id)

    await upsertByUrl(bob.id, { ...base, url: "https://bobonly.example.com/" })

    assert.equal(await countBookmarks(alice.id), aliceCount, "alice's count must not move")
    assert.equal(await countBookmarks(bob.id), bobCount + 1)
  })

  it("keeps folders separate, including the same name", async () => {
    const a = await createFolder(alice.id, "Reading")
    const b = await createFolder(bob.id, "Reading")

    assert.ok(a.ok, "the same folder name must be allowed for a different account")
    assert.ok(b.ok)

    assert.equal((await listFolders(alice.id)).length, 1)
    assert.equal((await listFolders(bob.id)).length, 1)
  })

  it("will not rename or delete another account's folder", async () => {
    const folder = await createFolder(alice.id, "Private")
    assert.ok(folder.ok)
    const id = folder.ok ? folder.folder.id : ""

    const renamed = await renameFolder(bob.id, id, "hijacked")
    assert.equal(renamed.ok, false)
    assert.equal(await deleteFolder(bob.id, id), false)

    const still = await listFolders(alice.id)
    assert.ok(still.some((f) => f.name === "Private"))
  })

  it("does not leak tags into another account's filter row", async () => {
    await upsertByUrl(alice.id, { ...base, url: "https://tagged.example.com/a", tags: ["alice-only"] })

    const bobTray = await loadTray(bob.id, listing)
    const bobTags = bobTray.allTags.flat()

    assert.ok(!bobTags.includes("alice-only"))
  })
})

/* -------------------------------------------------------------------------- */
/* Merge and screenshot rules                                                  */
/* -------------------------------------------------------------------------- */

describe("upsertByUrl, screenshot replacement", () => {
  it("reports the screenshot it replaced, so the caller can delete it", async () => {
    await upsertByUrl(alice.id, { ...base, url: "https://shots.example.com/a", screenshotUrl: "https://blob/one.jpg" })

    const second = await upsertByUrl(alice.id, {
      ...base,
      url: "https://shots.example.com/a",
      screenshotUrl: "https://blob/two.jpg"
    })

    assert.equal(second.updated, true)
    assert.equal(second.replacedScreenshotUrl, "https://blob/one.jpg")
    assert.equal(second.bookmark.screenshot_url, "https://blob/two.jpg")
  })

  it("reports nothing on a first capture, there is no old file", async () => {
    const first = await upsertByUrl(alice.id, {
      ...base,
      url: "https://shots.example.com/b",
      screenshotUrl: "https://blob/new.jpg"
    })

    assert.equal(first.updated, false)
    assert.equal(first.replacedScreenshotUrl, null)
  })

  it("keeps the existing picture when a recapture brings none", async () => {
    await upsertByUrl(alice.id, { ...base, url: "https://shots.example.com/c", screenshotUrl: "https://blob/keep.jpg" })
    const again = await upsertByUrl(alice.id, { ...base, url: "https://shots.example.com/c" })

    assert.equal(again.replacedScreenshotUrl, null, "nothing was replaced, so nothing should be deleted")
    assert.equal(again.bookmark.screenshot_url, "https://blob/keep.jpg")
  })

  it("reports nothing when the same picture is sent twice", async () => {
    await upsertByUrl(alice.id, { ...base, url: "https://shots.example.com/d", screenshotUrl: "https://blob/same.jpg" })
    const again = await upsertByUrl(alice.id, {
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
    await upsertByUrl(alice.id, { ...base, url: "https://merge.example.com/a", tags: ["one", "two"] })
    const again = await upsertByUrl(alice.id, { ...base, url: "https://merge.example.com/a", tags: ["two", "three"] })

    assert.deepEqual(again.bookmark.tags.sort(), ["one", "three", "two"])
  })

  it("keeps the existing note unless a new one is supplied", async () => {
    await upsertByUrl(alice.id, { ...base, url: "https://merge.example.com/b", notes: "original" })

    const blank = await upsertByUrl(alice.id, { ...base, url: "https://merge.example.com/b", notes: "   " })
    assert.equal(blank.bookmark.notes, "original")

    const replaced = await upsertByUrl(alice.id, { ...base, url: "https://merge.example.com/b", notes: "newer" })
    assert.equal(replaced.bookmark.notes, "newer")
  })

  it("does not drag a filed bookmark back out when the picker says unfiled", async () => {
    const folder = await createFolder(alice.id, "Filed")
    assert.ok(folder.ok)
    const folderId = folder.ok ? folder.folder.id : null

    await upsertByUrl(alice.id, { ...base, url: "https://merge.example.com/c", folderId })
    const again = await upsertByUrl(alice.id, { ...base, url: "https://merge.example.com/c", folderId: null })

    assert.equal(again.bookmark.folder_id, folderId)
  })

  it("never duplicates a url within one account", async () => {
    const before = await countBookmarks(alice.id)
    await upsertByUrl(alice.id, { ...base, url: "https://merge.example.com/d" })
    await upsertByUrl(alice.id, { ...base, url: "https://merge.example.com/d" })

    assert.equal((await countBookmarks(alice.id)) - before, 1)
  })
})

/* -------------------------------------------------------------------------- */
/* Filtering                                                                   */
/* -------------------------------------------------------------------------- */

describe("loadTray", () => {
  it("returns rows, total, folders and tags in one call", async () => {
    const tray = await loadTray(alice.id, listing)

    assert.ok(Array.isArray(tray.rows))
    assert.ok(Array.isArray(tray.folders))
    assert.ok(Array.isArray(tray.allTags))
    assert.equal(typeof tray.total, "number")
  })

  it("filters by tag through json_each, not a substring match", async () => {
    await upsertByUrl(alice.id, { ...base, url: "https://tags.example.com/a", tags: ["react"] })
    await upsertByUrl(alice.id, { ...base, url: "https://tags.example.com/b", tags: ["reactive"] })

    const tray = await loadTray(alice.id, { ...listing, tag: "react" })
    const urls = tray.rows.map((r) => r.url)

    assert.ok(urls.includes("https://tags.example.com/a"))
    assert.ok(!urls.includes("https://tags.example.com/b"), "reactive is a different tag, not a match")
  })

  it("treats a percent in a search term as a literal", async () => {
    await upsertByUrl(alice.id, { ...base, url: "https://search.example.com/a", title: "50% off sale" })
    await upsertByUrl(alice.id, { ...base, url: "https://search.example.com/b", title: "nothing special" })

    const tray = await loadTray(alice.id, { ...listing, q: "50% off" })

    assert.equal(tray.total, 1)
    assert.equal(tray.rows[0].url, "https://search.example.com/a")
  })

  it("narrows to starred only", async () => {
    const created = await upsertByUrl(alice.id, { ...base, url: "https://starred.example.com/a" })
    await setStarred(alice.id, created.bookmark.id, true)

    const tray = await loadTray(alice.id, { ...listing, starredOnly: true })

    assert.ok(tray.total >= 1)
    assert.ok(tray.rows.every((r) => r.starred))
  })

  it("finds unfiled bookmarks with the none folder", async () => {
    const tray = await loadTray(alice.id, { ...listing, folder: "none" })
    assert.ok(tray.rows.every((r) => r.folder_id === null))
  })

  it("counts the whole match, not just the page", async () => {
    const paged = await loadTray(alice.id, { ...listing, limit: 1, offset: 0 })

    assert.equal(paged.rows.length, 1)
    assert.ok(paged.total > 1, "total should describe every match, not the page size")
  })
})

describe("deleteBookmark", () => {
  it("hands back the screenshot url so the caller can clean it up", async () => {
    const created = await upsertByUrl(alice.id, {
      ...base,
      url: "https://gone.example.com/a",
      screenshotUrl: "https://blob/doomed.jpg"
    })

    assert.equal(await deleteBookmark(alice.id, created.bookmark.id), "https://blob/doomed.jpg")
  })

  it("returns null for a bookmark that is not there", async () => {
    assert.equal(await deleteBookmark(alice.id, "00000000-0000-0000-0000-000000000000"), null)
  })
})
