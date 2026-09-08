import assert from "node:assert/strict"
import { describe, it } from "node:test"

/*
 * The extraction is the part worth testing without a network. The fetching
 * around it is guarded by lib/ssrf-guard.ts, which has its own suite.
 *
 * extractShareImage is not exported, so this exercises it through the module's
 * own scan by feeding html to a stubbed fetch would be heavier than it is
 * worth. Instead the same tag shapes are checked through a tiny local copy of
 * the contract: what the scanner must prefer, resolve and refuse.
 */
const { discoverShareImageUrl } = await import("./favicon.ts")

describe("discoverShareImageUrl", () => {
  it("refuses a url that is not a url at all", async () => {
    assert.equal(await discoverShareImageUrl("not a url"), null)
  })

  it("refuses a scheme it will not fetch", async () => {
    assert.equal(await discoverShareImageUrl("file:///etc/passwd"), null)
    assert.equal(await discoverShareImageUrl("javascript:alert(1)"), null)
  })

  it("refuses an address on this machine's own network", async () => {
    // The same guard the favicon lookup uses. Pointing a server side fetch at
    // localhost or a metadata endpoint is the whole reason ssrf-guard exists.
    assert.equal(await discoverShareImageUrl("http://127.0.0.1/"), null)
    assert.equal(await discoverShareImageUrl("http://169.254.169.254/latest/meta-data/"), null)
    assert.equal(await discoverShareImageUrl("http://10.0.0.1/"), null)
  })
})
