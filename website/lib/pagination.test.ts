import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { PAGE_SIZE, pageRange, pageWindow, parsePage, totalPages } from "./pagination.ts"

describe("parsePage", () => {
  it("defaults to the first page for anything unusable", () => {
    for (const input of [undefined, "", "0", "-4", "abc", "1.5.2", "NaN"]) {
      assert.equal(parsePage(input), 1, `${String(input)} should fall back to page 1`)
    }
  })

  it("reads a real page number", () => {
    assert.equal(parsePage("2"), 2)
    assert.equal(parsePage("417"), 417)
  })

  it("caps absurd input so the offset stays sane", () => {
    assert.equal(parsePage("99999999"), 10_000)
  })
})

describe("pageRange", () => {
  it("produces inclusive bounds that do not overlap", () => {
    assert.deepEqual(pageRange(1), [0, PAGE_SIZE - 1])
    assert.deepEqual(pageRange(2), [PAGE_SIZE, PAGE_SIZE * 2 - 1])

    const [, firstTo] = pageRange(1)
    const [secondFrom] = pageRange(2)
    assert.equal(secondFrom, firstTo + 1)
  })
})

describe("totalPages", () => {
  it("never reports zero pages, an empty tray is still page one", () => {
    assert.equal(totalPages(0), 1)
  })

  it("rounds a partial page up", () => {
    assert.equal(totalPages(1), 1)
    assert.equal(totalPages(PAGE_SIZE), 1)
    assert.equal(totalPages(PAGE_SIZE + 1), 2)
    assert.equal(totalPages(PAGE_SIZE * 3), 3)
  })
})

describe("pageWindow", () => {
  it("lists every page when there are few enough", () => {
    assert.deepEqual(pageWindow(1, 1), [1])
    assert.deepEqual(pageWindow(3, 7), [1, 2, 3, 4, 5, 6, 7])
  })

  it("always includes the first page, the last page and the current one", () => {
    for (const current of [1, 2, 5, 11, 19, 20]) {
      const window = pageWindow(current, 20)
      assert.ok(window.includes(1), `page 1 missing at current ${current}`)
      assert.ok(window.includes(20), `last page missing at current ${current}`)
      assert.ok(window.includes(current), `current ${current} missing`)
    }
  })

  it("gaps the middle rather than listing forty numbers", () => {
    assert.deepEqual(pageWindow(10, 20), [1, null, 9, 10, 11, null, 20])
  })

  it("pads the ends so the strip keeps a steady width", () => {
    assert.deepEqual(pageWindow(1, 20), [1, 2, 3, 4, 5, null, 20])
    assert.deepEqual(pageWindow(20, 20), [1, null, 16, 17, 18, 19, 20])
  })

  it("never emits two gaps in a row or a gap at either end", () => {
    for (let last = 1; last <= 40; last++) {
      for (let current = 1; current <= last; current++) {
        const window = pageWindow(current, last)

        assert.notEqual(window[0], null, `leading gap at ${current}/${last}`)
        assert.notEqual(window.at(-1), null, `trailing gap at ${current}/${last}`)

        for (let i = 1; i < window.length; i++) {
          assert.ok(
            !(window[i] === null && window[i - 1] === null),
            `two gaps in a row at ${current}/${last}`
          )
        }

        const numbers = window.filter((n): n is number => n !== null)
        assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b), `unsorted at ${current}/${last}`)
        assert.equal(new Set(numbers).size, numbers.length, `duplicate page at ${current}/${last}`)
      }
    }
  })
})
