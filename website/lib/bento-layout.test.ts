import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { LAYOUTS, SHAPE_SPANS, compartment, compartmentFor, parseLayout, trayGrid } from "./bento-layout.ts"
import { PAGE_SIZE } from "./pagination.ts"

describe("layout cycles", () => {
  /*
   * PAGE_SIZE is 36 because that is four clean turns of the nine shape cycle,
   * so a full page tiles without a ragged last row. A cycle of five would
   * leave one over every time. Asserted rather than left as a comment, since
   * adding a preset is exactly when somebody would not think to check.
   */
  it("every cycle divides a full page, so no page ends ragged", () => {
    for (const layout of LAYOUTS) {
      assert.equal(
        PAGE_SIZE % layout.cycle.length,
        0,
        `${layout.key} has ${layout.cycle.length} shapes, which does not divide ${PAGE_SIZE}`
      )
    }
  })

  it("repeats rather than running off the end", () => {
    for (const layout of LAYOUTS) {
      assert.deepEqual(
        compartmentFor(0, null, layout.key),
        compartmentFor(layout.cycle.length, null, layout.key)
      )
      assert.ok(compartmentFor(1000, null, layout.key))
    }
  })

  it("falls back to the contact sheet for a layout nobody offers", () => {
    assert.equal(parseLayout("nonsense"), "contact")
    assert.equal(parseLayout(undefined), "contact")
    assert.equal(parseLayout("compact"), "compact")
  })

  it("keeps compartment on the default cycle, which is all the skeleton knows", () => {
    for (let i = 0; i < 12; i++) {
      assert.deepEqual(compartment(i), compartmentFor(i, null, "contact"))
    }
  })
})

describe("a shape set by hand", () => {
  it("beats the cycle, whichever layout is on", () => {
    for (const layout of LAYOUTS) {
      assert.deepEqual(compartmentFor(3, "wide", layout.key), SHAPE_SPANS.wide)
      assert.deepEqual(compartmentFor(0, "small", layout.key), SHAPE_SPANS.small)
    }
  })

  it("only ever spans widths the grid actually has", () => {
    // Two columns at the base breakpoint, so nothing may ask for more.
    for (const span of Object.values(SHAPE_SPANS)) {
      assert.match(span.className, /^col-span-[12] row-span-[12] /)
    }
  })
})

describe("the grid container", () => {
  /*
   * Dense packing lets the browser move a frame somewhere other than where it
   * was dropped, so an arrangement saves one order and shows another.
   */
  it("drops dense packing when the sheet can be arranged", () => {
    assert.ok(trayGrid(false).includes("row_dense"))
    assert.ok(!trayGrid(true).includes("row_dense"))
  })

  it("keeps the same tracks either way, so switching does not resize anything", () => {
    assert.ok(trayGrid(true).includes("lg:grid-cols-6"))
    assert.ok(trayGrid(true).includes("auto-rows-[112px]"))
  })
})
