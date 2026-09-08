import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { parseNetscapeBookmarks } from "./netscape.ts"

/**
 * Shaped like what the browsers actually write, unclosed tags and all. Chrome,
 * Brave and Edge produce the same thing; Firefox differs mainly by omitting
 * the icons and by exporting its smart folders as place: urls.
 */
const CHROME = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1600000000" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://react.dev/" ADD_DATE="1700000000" ICON="data:image/png;base64,iVBORw0KGgo=">React</A>
        <DT><H3 ADD_DATE="1600000001">Dev</H3>
        <DL><p>
            <DT><A HREF="https://nodejs.org/" ADD_DATE="1700000001">Node.js</A>
            <DT><H3>Rust</H3>
            <DL><p>
                <DT><A HREF="https://doc.rust-lang.org/book/" ADD_DATE="1700000002">The Book &amp; more</A>
            </DL><p>
        </DL><p>
    </DL><p>
    <DT><H3>Other bookmarks</H3>
    <DL><p>
        <DT><A HREF="https://example.com/loose">Loose one</A>
    </DL><p>
</DL><p>`

describe("parseNetscapeBookmarks", () => {
  it("reads every bookmark in the file", () => {
    const result = parseNetscapeBookmarks(CHROME)
    assert.equal(result.bookmarks.length, 4)
  })

  it("flattens nesting to the deepest folder, which is the one you named", () => {
    const { bookmarks } = parseNetscapeBookmarks(CHROME)
    const byUrl = Object.fromEntries(bookmarks.map((b) => [b.url, b.folder]))

    assert.equal(byUrl["https://nodejs.org/"], "Dev")
    assert.equal(byUrl["https://doc.rust-lang.org/book/"], "Rust")
  })

  it("treats the browser's own containers as the root, not as folders", () => {
    // Landing everything in a folder called "Bookmarks bar" would be noise.
    const { bookmarks, folders } = parseNetscapeBookmarks(CHROME)
    const byUrl = Object.fromEntries(bookmarks.map((b) => [b.url, b.folder]))

    assert.equal(byUrl["https://react.dev/"], null)
    assert.equal(byUrl["https://example.com/loose"], null)
    assert.deepEqual(folders, ["Dev", "Rust"])
  })

  it("decodes entities in titles", () => {
    const { bookmarks } = parseNetscapeBookmarks(CHROME)
    const rust = bookmarks.find((b) => b.url.includes("rust-lang"))
    assert.equal(rust?.title, "The Book & more")
  })

  it("keeps the date the browser recorded, so the sheet keeps its order", () => {
    const { bookmarks } = parseNetscapeBookmarks(CHROME)
    const react = bookmarks.find((b) => b.url === "https://react.dev/")

    assert.equal(react?.addedAt, new Date(1_700_000_000 * 1000).toISOString())
  })

  it("has no date when the browser did not write one", () => {
    const { bookmarks } = parseNetscapeBookmarks(CHROME)
    assert.equal(bookmarks.find((b) => b.url.includes("loose"))?.addedAt, null)
  })
})

describe("what it refuses", () => {
  it("drops anything that is not http or https", () => {
    const html = `<DL><p>
      <DT><A HREF="javascript:alert(1)">Bookmarklet</A>
      <DT><A HREF="place:type=6&amp;sort=14">Firefox smart folder</A>
      <DT><A HREF="chrome://bookmarks/">Internal page</A>
      <DT><A HREF="file:///C:/notes.txt">A file</A>
      <DT><A HREF="https://keep.example.com/">Keep this</A>
    </DL><p>`

    const { bookmarks, skipped } = parseNetscapeBookmarks(html)

    assert.deepEqual(
      bookmarks.map((b) => b.url),
      ["https://keep.example.com/"]
    )
    assert.equal(skipped["not a web address"], 4)
  })

  it("keeps the first of a repeated address and counts the rest", () => {
    const html = `<DL><p>
      <DT><A HREF="https://example.com/x">First</A>
      <DT><A HREF="https://example.com/x">Second</A>
      <DT><A HREF="https://example.com/x">Third</A>
    </DL><p>`

    const { bookmarks, skipped } = parseNetscapeBookmarks(html)

    assert.equal(bookmarks.length, 1)
    assert.equal(bookmarks[0].title, "First")
    assert.equal(skipped["duplicate in the file"], 2)
  })

  it("survives a file with nothing in it", () => {
    assert.deepEqual(parseNetscapeBookmarks(""), { bookmarks: [], folders: [], skipped: {} })
    assert.deepEqual(parseNetscapeBookmarks("<html><body>not a bookmark file</body></html>").bookmarks, [])
  })
})

describe("the embedded icon", () => {
  const withIcon = (icon: string) =>
    parseNetscapeBookmarks(`<DL><p><DT><A HREF="https://example.com/" ICON="${icon}">X</A></DL><p>`)
      .bookmarks[0].faviconUrl

  it("keeps a real image, so an imported sheet arrives with its icons", () => {
    assert.equal(withIcon("data:image/png;base64,iVBORw0KGgo="), "data:image/png;base64,iVBORw0KGgo=")
  })

  it("refuses anything that is not an image", () => {
    /*
     * This value goes into an img src and the file came from outside, so a
     * data uri claiming to be something else is dropped rather than trusted.
     */
    assert.equal(withIcon("data:text/html;base64,PHNjcmlwdD4="), null)
    assert.equal(withIcon("javascript:alert(1)"), null)
    assert.equal(withIcon("https://evil.example.com/track.gif"), null)
  })

  it("refuses one too large to be a favicon", () => {
    // It would otherwise be carried in every tray query from then on.
    assert.equal(withIcon(`data:image/png;base64,${"A".repeat(9000)}`), null)
  })

  it("is null when the browser wrote none, which is what Firefox does", () => {
    const { bookmarks } = parseNetscapeBookmarks(`<DL><p><DT><A HREF="https://example.com/">X</A></DL><p>`)
    assert.equal(bookmarks[0].faviconUrl, null)
  })
})

describe("attribute quoting, which browsers are not consistent about", () => {
  it("reads single quotes and no quotes as well as double", () => {
    const html = `<DL><p>
      <DT><A HREF='https://single.example.com/'>Single</A>
      <DT><A HREF=https://bare.example.com/ ADD_DATE=1700000000>Bare</A>
    </DL><p>`

    const { bookmarks } = parseNetscapeBookmarks(html)
    assert.deepEqual(
      bookmarks.map((b) => b.url).sort(),
      ["https://bare.example.com/", "https://single.example.com/"]
    )
  })
})
