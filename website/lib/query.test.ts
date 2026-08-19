import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { trayHref } from "./query.ts"

const params = (init: string) => new URLSearchParams(init)

describe("trayHref", () => {
  it("returns a bare path when nothing is set", () => {
    assert.equal(trayHref(params(""), {}), "/app")
  })

  it("sets and clears individual filters", () => {
    assert.equal(trayHref(params(""), { tag: "react" }), "/app?tag=react")
    assert.equal(trayHref(params("tag=react"), { tag: null }), "/app")
    assert.equal(trayHref(params("tag=react"), { tag: "" }), "/app")
  })

  it("keeps the filters it was not asked to change", () => {
    const href = trayHref(params("q=urushi&star=1"), { tag: "craft" })
    const result = new URL(href, "https://x.test").searchParams

    assert.equal(result.get("q"), "urushi")
    assert.equal(result.get("star"), "1")
    assert.equal(result.get("tag"), "craft")
  })

  it("drops the page when a filter changes, because page 7 of the old set means nothing", () => {
    assert.equal(trayHref(params("page=7"), { tag: "react" }), "/app?tag=react")
    assert.equal(trayHref(params("page=7&q=a"), { star: "1" }), "/app?q=a&star=1")
  })

  it("keeps the page when paging is what changed", () => {
    assert.equal(trayHref(params("tag=react"), { page: "3" }), "/app?tag=react&page=3")
  })

  it("treats page one as no page at all, so the url stays clean", () => {
    assert.equal(trayHref(params("tag=react&page=4"), { page: null }), "/app?tag=react")
  })

  it("escapes values rather than pasting them in raw", () => {
    const href = trayHref(params(""), { q: "a b&c=d" })
    assert.ok(!href.includes("a b"), "space should be encoded")
    assert.equal(new URL(href, "https://x.test").searchParams.get("q"), "a b&c=d")
  })
})
