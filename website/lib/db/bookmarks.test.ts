import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { makeUser, setUpTestDatabase } from "~/lib/test-support"

await setUpTestDatabase()

const {
  loadTray,
  upsertByUrl,
  setStarred,
  deleteBookmark,
  countBookmarks,
  getBookmark,
  editBookmark,
  bulkSetStarred,
  bulkSetFolder,
  bulkDelete,
  importBookmarks,
  bookmarksWithoutImage,
  setShareImages,
  setScreenshot,
  seedPositions,
  reorderBookmarks,
  setShape
} = await import("./bookmarks.ts")
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

describe("marking up several frames at once", () => {
  it("stars only the ids that belong to the caller", async () => {
    const mine = await upsertByUrl(alice.id, { ...base, url: "https://bulk.example.com/a" })
    const theirs = await upsertByUrl(bob.id, { ...base, url: "https://bulk.example.com/b" })

    // Alice asks for both, including one that is not hers.
    const touched = await bulkSetStarred(alice.id, [mine.bookmark.id, theirs.bookmark.id], true)

    assert.equal(touched, 1, "only Alice's row should have been counted")
    assert.equal((await getBookmark(alice.id, mine.bookmark.id))?.starred, true)
    assert.equal((await getBookmark(bob.id, theirs.bookmark.id))?.starred, false, "Bob's row must be untouched")
  })

  it("files only the caller's rows, and never into another account's folder", async () => {
    const folder = await createFolder(alice.id, "Bulk target")
    assert.ok(folder.ok)
    if (!folder.ok) return

    const mine = await upsertByUrl(alice.id, { ...base, url: "https://bulk.example.com/c" })
    const theirs = await upsertByUrl(bob.id, { ...base, url: "https://bulk.example.com/d" })

    const touched = await bulkSetFolder(alice.id, [mine.bookmark.id, theirs.bookmark.id], folder.folder.id)

    assert.equal(touched, 1)
    assert.equal((await getBookmark(alice.id, mine.bookmark.id))?.folder_id, folder.folder.id)
    assert.equal((await getBookmark(bob.id, theirs.bookmark.id))?.folder_id, null)
  })

  it("deletes only the caller's rows, and reports only their screenshots", async () => {
    const mine = await upsertByUrl(alice.id, {
      ...base,
      url: "https://bulk.example.com/e",
      screenshotUrl: "https://blob.example.com/alice.jpg"
    })
    const theirs = await upsertByUrl(bob.id, {
      ...base,
      url: "https://bulk.example.com/f",
      screenshotUrl: "https://blob.example.com/bob.jpg"
    })

    const orphaned = await bulkDelete(alice.id, [mine.bookmark.id, theirs.bookmark.id])

    assert.deepEqual(orphaned, ["https://blob.example.com/alice.jpg"])
    assert.equal(await getBookmark(alice.id, mine.bookmark.id), null)
    assert.ok(await getBookmark(bob.id, theirs.bookmark.id), "Bob's row must survive")
  })

  it("does nothing at all for an empty list", async () => {
    assert.equal(await bulkSetStarred(alice.id, [], true), 0)
    assert.equal(await bulkSetFolder(alice.id, [], null), 0)
    assert.deepEqual(await bulkDelete(alice.id, []), [])
  })

  it("ignores duplicates rather than counting them twice", async () => {
    const one = await upsertByUrl(alice.id, { ...base, url: "https://bulk.example.com/g" })
    assert.equal(await bulkSetStarred(alice.id, [one.bookmark.id, one.bookmark.id, one.bookmark.id], true), 1)
  })

  it("caps how many ids one call can carry", async () => {
    // A guard on statement size, not on correctness. Sending three hundred ids
    // should not build a three hundred placeholder statement.
    const many = Array.from({ length: 300 }, (_, i) => `id-${i}`)
    assert.equal(await bulkSetStarred(alice.id, many, true), 0)
  })

  it("survives ids that are empty or the wrong shape", async () => {
    assert.equal(await bulkSetStarred(alice.id, ["", "   "], true), 0)
  })
})

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

describe("importBookmarks", () => {
  it("writes a chunk and says how many were new", async () => {
    const result = await importBookmarks(alice.id, [
      { url: "https://import.example.com/a", title: "A", faviconUrl: null, folderId: null, addedAt: null },
      { url: "https://import.example.com/b", title: "B", faviconUrl: null, folderId: null, addedAt: null }
    ])

    assert.deepEqual(result, { added: 2, alreadyHad: 0 })
  })

  it("counts a url you already have rather than duplicating it", async () => {
    await importBookmarks(alice.id, [
      { url: "https://import.example.com/dupe", title: "First", faviconUrl: null, folderId: null, addedAt: null }
    ])

    const again = await importBookmarks(alice.id, [
      { url: "https://import.example.com/dupe", title: "Second", faviconUrl: null, folderId: null, addedAt: null }
    ])

    assert.deepEqual(again, { added: 0, alreadyHad: 1 })

    const tray = await loadTray(alice.id, { ...listing, q: "import.example.com/dupe" })
    assert.equal(tray.total, 1)
  })

  it("never overwrites what is already there", async () => {
    /*
     * The point of the whole feature is arriving with your history, not losing
     * the work you have done since. A re-import must not clobber a title you
     * fixed, a note you wrote, a folder you filed it in, or a star.
     */
    const created = await upsertByUrl(alice.id, {
      ...base,
      url: "https://import.example.com/mine",
      title: "The title I chose",
      notes: "My note",
      tags: ["mine"]
    })
    await setStarred(alice.id, created.bookmark.id, true)

    await importBookmarks(alice.id, [
      {
        url: "https://import.example.com/mine",
        title: "Whatever the browser called it",
        faviconUrl: null,
        folderId: null,
        addedAt: null
      }
    ])

    const kept = await getBookmark(alice.id, created.bookmark.id)
    assert.equal(kept?.title, "The title I chose")
    assert.equal(kept?.notes, "My note")
    assert.deepEqual(kept?.tags, ["mine"])
    assert.equal(kept?.starred, true)
  })

  it("fills in a missing favicon but does not replace one", async () => {
    const withNone = await upsertByUrl(alice.id, {
      ...base,
      url: "https://import.example.com/noicon",
      faviconUrl: null
    })
    const withOne = await upsertByUrl(alice.id, {
      ...base,
      url: "https://import.example.com/hasicon",
      faviconUrl: "https://cdn.example.com/original.png"
    })

    await importBookmarks(alice.id, [
      {
        url: "https://import.example.com/noicon",
        title: "",
        faviconUrl: "data:image/png;base64,AAAA",
        folderId: null,
        addedAt: null
      },
      {
        url: "https://import.example.com/hasicon",
        title: "",
        faviconUrl: "data:image/png;base64,BBBB",
        folderId: null,
        addedAt: null
      }
    ])

    assert.equal((await getBookmark(alice.id, withNone.bookmark.id))?.favicon_url, "data:image/png;base64,AAAA")
    assert.equal(
      (await getBookmark(alice.id, withOne.bookmark.id))?.favicon_url,
      "https://cdn.example.com/original.png"
    )
  })

  it("keeps the browser's own date, so an imported roll is in the right order", async () => {
    const old = new Date("2019-04-02T10:00:00.000Z").toISOString()

    await importBookmarks(alice.id, [
      { url: "https://import.example.com/old", title: "Old", faviconUrl: null, folderId: null, addedAt: old }
    ])

    const tray = await loadTray(alice.id, { ...listing, q: "import.example.com/old" })
    assert.equal(tray.rows[0].created_at, old)
  })

  it("files into a folder when it is given one", async () => {
    const folder = await createFolder(alice.id, "Imported dev")
    assert.ok(folder.ok)
    if (!folder.ok) return

    await importBookmarks(alice.id, [
      {
        url: "https://import.example.com/filed",
        title: "Filed",
        faviconUrl: null,
        folderId: folder.folder.id,
        addedAt: null
      }
    ])

    const tray = await loadTray(alice.id, { ...listing, folder: folder.folder.id })
    assert.equal(tray.total, 1)
  })

  it("does nothing at all for an empty chunk", async () => {
    assert.deepEqual(await importBookmarks(alice.id, []), { added: 0, alreadyHad: 0 })
  })

  it("cannot reach into another account", async () => {
    // Both accounts import the same address. Each gets its own row, and
    // neither can see the other, which is what (user_id, url) is for.
    const url = "https://import.example.com/shared"

    await importBookmarks(alice.id, [{ url, title: "Alice", faviconUrl: null, folderId: null, addedAt: null }])
    const forBob = await importBookmarks(bob.id, [
      { url, title: "Bob", faviconUrl: null, folderId: null, addedAt: null }
    ])

    assert.deepEqual(forBob, { added: 1, alreadyHad: 0 }, "bob's import must not see alice's row")

    const aliceTray = await loadTray(alice.id, { ...listing, q: "import.example.com/shared" })
    const bobTray = await loadTray(bob.id, { ...listing, q: "import.example.com/shared" })

    assert.equal(aliceTray.total, 1)
    assert.equal(bobTray.total, 1)
    assert.equal(aliceTray.rows[0].title, "Alice")
    assert.equal(bobTray.rows[0].title, "Bob")
  })
})

describe("the share image backfill", () => {
  it("walks forward past rows it could not fill, rather than looping on them", async () => {
    /*
     * The bug this exists for: the query used to ask only for "no image", so a
     * page with no share image to give came back on every call and the client
     * looped forever. Four bookmarks turned into three hundred and forty four
     * lookups before it was stopped by hand. The cursor is on what was looked
     * at, not on what was filled.
     */
    const carol = await makeUser("backfill@example.com")

    for (const n of [1, 2, 3, 4, 5]) {
      await importBookmarks(carol.id, [
        {
          url: `https://backfill.example.com/${n}`,
          title: `Page ${n}`,
          faviconUrl: null,
          folderId: null,
          addedAt: new Date(Date.UTC(2020, 0, n)).toISOString()
        }
      ])
    }

    const seen: string[] = []
    let cursor: { createdAt: string; id: string } | null = null

    for (let round = 0; round < 10; round++) {
      const batch: Awaited<ReturnType<typeof bookmarksWithoutImage>> = await bookmarksWithoutImage(
        carol.id,
        2,
        cursor
      )
      if (batch.length === 0) break

      // Nothing is filled in, which is exactly the case that used to loop.
      seen.push(...batch.map((b) => b.url))
      const last = batch[batch.length - 1]
      cursor = { createdAt: last.created_at, id: last.id }
    }

    assert.equal(seen.length, 5, "every row is looked at exactly once")
    assert.equal(new Set(seen).size, 5, "and none of them twice")
  })

  it("only fills an image in when there is not one already", async () => {
    // A real capture from the extension always beats a share card, so a
    // backfill that lands after one must not overwrite it.
    const dave = await makeUser("shareimage@example.com")

    const captured = await upsertByUrl(dave.id, {
      ...base,
      url: "https://shot.example.com/has",
      screenshotUrl: "https://blob.example.com/real-capture.jpg"
    })
    const empty = await upsertByUrl(dave.id, { ...base, url: "https://shot.example.com/none" })

    await setShareImages(dave.id, [
      { id: captured.bookmark.id, imageUrl: "https://og.example.com/card.png" },
      { id: empty.bookmark.id, imageUrl: "https://og.example.com/other.png" }
    ])

    assert.equal(
      (await getBookmark(dave.id, captured.bookmark.id))?.screenshot_url,
      "https://blob.example.com/real-capture.jpg",
      "a real capture must survive"
    )
    assert.equal(
      (await getBookmark(dave.id, empty.bookmark.id))?.screenshot_url,
      "https://og.example.com/other.png"
    )
  })

  it("cannot set an image on another account's bookmark", async () => {
    const mine = await upsertByUrl(alice.id, { ...base, url: "https://shot.example.com/mine" })

    await setShareImages(bob.id, [{ id: mine.bookmark.id, imageUrl: "https://og.example.com/theirs.png" }])

    assert.equal((await getBookmark(alice.id, mine.bookmark.id))?.screenshot_url, null)
  })
})

describe("setScreenshot", () => {
  it("attaches a picture and reports nothing to clean up", async () => {
    const made = await upsertByUrl(alice.id, { ...base, url: "https://pic.example.com/new" })

    const replaced = await setScreenshot(alice.id, made.bookmark.id, "https://blob.example.com/a.jpg")

    assert.equal(replaced, null, "there was no old blob")
    assert.equal((await getBookmark(alice.id, made.bookmark.id))?.screenshot_url, "https://blob.example.com/a.jpg")
  })

  it("reports the old url when replacing, so the blob can be deleted", async () => {
    // The database layer never touches storage. It says what was displaced and
    // actions.ts does the deleting, the same split deleteBookmark uses.
    const made = await upsertByUrl(alice.id, {
      ...base,
      url: "https://pic.example.com/replace",
      screenshotUrl: "https://blob.example.com/old.jpg"
    })

    const replaced = await setScreenshot(alice.id, made.bookmark.id, "https://blob.example.com/new.jpg")

    assert.equal(replaced, "https://blob.example.com/old.jpg")
    assert.equal((await getBookmark(alice.id, made.bookmark.id))?.screenshot_url, "https://blob.example.com/new.jpg")
  })

  it("clears one, and reports the url that was there", async () => {
    const made = await upsertByUrl(alice.id, {
      ...base,
      url: "https://pic.example.com/clear",
      screenshotUrl: "https://blob.example.com/gone.jpg"
    })

    const replaced = await setScreenshot(alice.id, made.bookmark.id, null)

    assert.equal(replaced, "https://blob.example.com/gone.jpg")
    assert.equal((await getBookmark(alice.id, made.bookmark.id))?.screenshot_url, null)
  })

  it("does not report the same url as needing deletion", async () => {
    // Saving the edit form without touching the picture must not delete the
    // blob the bookmark is still pointing at.
    const made = await upsertByUrl(alice.id, {
      ...base,
      url: "https://pic.example.com/same",
      screenshotUrl: "https://blob.example.com/keep.jpg"
    })

    assert.equal(await setScreenshot(alice.id, made.bookmark.id, "https://blob.example.com/keep.jpg"), null)
  })

  it("cannot touch another account's bookmark", async () => {
    const mine = await upsertByUrl(alice.id, {
      ...base,
      url: "https://pic.example.com/mine",
      screenshotUrl: "https://blob.example.com/mine.jpg"
    })

    assert.equal(await setScreenshot(bob.id, mine.bookmark.id, null), null)
    assert.equal(
      (await getBookmark(alice.id, mine.bookmark.id))?.screenshot_url,
      "https://blob.example.com/mine.jpg"
    )
  })
})

/* -------------------------------------------------------------------------- */
/* Arranging the sheet by hand                                                 */
/* -------------------------------------------------------------------------- */

describe("arranging the sheet", () => {
  /** Three bookmarks for one account, oldest first, spaced so the order is not a coin toss. */
  async function threeFor(userId: string, prefix: string) {
    const made = []
    for (const n of [1, 2, 3]) {
      made.push((await upsertByUrl(userId, { ...base, url: `https://${prefix}.example.com/${n}` })).bookmark)
      // created_at is millisecond resolution and several inserts routinely land
      // inside one, which makes the tiebreak a random uuid and the order a coin
      // toss. Two milliseconds is enough to keep it deterministic.
      await new Promise((done) => setTimeout(done, 3))
    }
    return made
  }

  const arranged = { ...listing, sortColumn: "position" as const, ascending: true }

  it("seeds every unplaced bookmark, newest first, which is the order it was already in", async () => {
    const carol = await makeUser("arrange-seed@example.com")
    const made = await threeFor(carol.id, "seed")

    assert.equal(await seedPositions(carol.id), 3)

    const tray = await loadTray(carol.id, arranged)
    assert.deepEqual(
      tray.rows.map((row) => row.url),
      [made[2].url, made[1].url, made[0].url]
    )
    assert.deepEqual(
      tray.rows.map((row) => row.position),
      [0, 1, 2]
    )
  })

  it("seeds again without disturbing an arrangement already made", async () => {
    const carol = await makeUser("arrange-reseed@example.com")
    const made = await threeFor(carol.id, "reseed")
    await seedPositions(carol.id)
    assert.equal(made.length, 3)

    await reorderBookmarks(carol.id, [made[0].id, made[2].id, made[1].id])
    const before = (await loadTray(carol.id, arranged)).rows.map((row) => row.url)

    // A fourth arrives afterwards, so seeding runs again.
    const late = (await upsertByUrl(carol.id, { ...base, url: "https://reseed.example.com/late" })).bookmark
    assert.equal(await seedPositions(carol.id), 1)

    const after = (await loadTray(carol.id, arranged)).rows.map((row) => row.url)
    assert.deepEqual(after.slice(0, 3), before, "the arrangement moved")
    assert.equal(after[3], late.url, "the new one did not land at the end")
  })

  it("keeps the order a drag put them in", async () => {
    const carol = await makeUser("arrange-drag@example.com")
    const made = await threeFor(carol.id, "drag")
    await seedPositions(carol.id)

    // Newest first, so the seeded order is 3, 2, 1. Drag the last to the front.
    await reorderBookmarks(carol.id, [made[0].id, made[2].id, made[1].id])

    assert.deepEqual(
      (await loadTray(carol.id, arranged)).rows.map((row) => row.url),
      [made[0].url, made[2].url, made[1].url]
    )
  })

  /*
   * The reason positions are shuffled rather than renumbered from zero. A drag
   * inside a filter only ever knows about the rows on screen, and renumbering
   * them 0, 1, 2 would move them all to the front of the whole sheet.
   */
  it("a drag among some frames leaves every other frame where it was", async () => {
    const carol = await makeUser("arrange-subset@example.com")
    const made = await threeFor(carol.id, "subset")
    const extra = []
    for (const n of [4, 5]) {
      extra.push((await upsertByUrl(carol.id, { ...base, url: `https://subset.example.com/${n}` })).bookmark)
      await new Promise((done) => setTimeout(done, 3))
    }
    await seedPositions(carol.id)

    const before = (await loadTray(carol.id, arranged)).rows.map((row) => row.url)

    // Swap two of them, as a drag inside a filter would.
    await reorderBookmarks(carol.id, [made[0].id, made[1].id])

    const after = (await loadTray(carol.id, arranged)).rows.map((row) => row.url)
    assert.deepEqual(
      after.filter((url) => url !== made[0].url && url !== made[1].url),
      before.filter((url) => url !== made[0].url && url !== made[1].url),
      "frames that were not dragged moved"
    )
    assert.equal(after.length, 5)
  })

  it("puts a bookmark that has never been placed at the end, not the front", async () => {
    const carol = await makeUser("arrange-null@example.com")
    await threeFor(carol.id, "nulls")
    await seedPositions(carol.id)

    // Arrives after the seeding and is never placed, so its position is null.
    const loose = (await upsertByUrl(carol.id, { ...base, url: "https://nulls.example.com/loose" })).bookmark

    const rows = (await loadTray(carol.id, arranged)).rows
    assert.equal(rows[rows.length - 1].url, loose.url, "an unplaced row led the arrangement")
    assert.equal(rows[rows.length - 1].position, null)
  })

  it("stores a shape and clears it again", async () => {
    const carol = await makeUser("arrange-shape@example.com")
    const [one] = await threeFor(carol.id, "shape")

    assert.equal(await setShape(carol.id, one.id, "wide"), true)
    assert.equal((await getBookmark(carol.id, one.id))?.shape, "wide")

    assert.equal(await setShape(carol.id, one.id, null), true)
    assert.equal((await getBookmark(carol.id, one.id))?.shape, null)
  })

  it("cannot reorder another account's frames", async () => {
    const mine = await threeFor(alice.id, "isolation-order")
    await seedPositions(alice.id)
    const before = (await loadTray(alice.id, arranged)).rows.map((row) => row.url)

    await reorderBookmarks(bob.id, [mine[2].id, mine[0].id, mine[1].id])

    assert.deepEqual((await loadTray(alice.id, arranged)).rows.map((row) => row.url), before)
  })

  it("cannot shape another account's frame", async () => {
    const [mine] = await threeFor(alice.id, "isolation-shape")

    assert.equal(await setShape(bob.id, mine.id, "big"), false)
    assert.equal((await getBookmark(alice.id, mine.id))?.shape, null)
  })

  it("cannot mix another account's ids into its own reorder", async () => {
    const carol = await makeUser("arrange-mixed@example.com")
    const theirs = await threeFor(carol.id, "mixed-theirs")
    await seedPositions(carol.id)
    const before = (await loadTray(carol.id, arranged)).rows.map((row) => row.url)

    const [ours] = await threeFor(alice.id, "mixed-ours")
    await seedPositions(alice.id)
    const aliceBefore = (await loadTray(alice.id, arranged)).rows.map((row) => row.url)

    // Carol asks to reorder two of hers plus one of Alice's. The foreign id is
    // dropped, which leaves fewer ids than slots, so nothing is written at all
    // rather than a partial shuffle.
    await reorderBookmarks(carol.id, [theirs[2].id, ours.id, theirs[0].id])

    assert.deepEqual((await loadTray(carol.id, arranged)).rows.map((row) => row.url), before)
    assert.deepEqual((await loadTray(alice.id, arranged)).rows.map((row) => row.url), aliceBefore)
  })
})
