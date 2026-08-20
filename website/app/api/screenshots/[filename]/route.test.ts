import assert from "node:assert/strict"
import { writeFileSync } from "node:fs"
import { after, describe, it } from "node:test"

import { cleanupDataDir, setUpTempDataDir } from "~/lib/test-support"

setUpTempDataDir()

const { GET } = await import("./route.ts")
const { screenshotDir } = await import("~/lib/db/client")

after(cleanupDataDir)

function get(filename: string) {
  return GET(new Request(`http://x/api/screenshots/${filename}`), {
    params: Promise.resolve({ filename })
  })
}

describe("GET /api/screenshots/[filename]", () => {
  it("needs no auth, matching the old public storage bucket", async () => {
    const filename = "11111111-1111-1111-1111-111111111111.jpg"
    writeFileSync(`${screenshotDir()}/${filename}`, Buffer.from([1, 2, 3]))

    const res = await get(filename)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get("content-type"), "image/jpeg")
    assert.equal(Buffer.from(await res.arrayBuffer()).length, 3)
  })

  it("404s on a filename that does not exist", async () => {
    const res = await get("22222222-2222-2222-2222-222222222222.jpg")
    assert.equal(res.status, 404)
  })

  it("refuses anything that is not exactly a uuid plus .jpg, path traversal included", async () => {
    for (const bad of [
      "../../../../etc/passwd",
      "..%2f..%2fsecret.jpg",
      "not-a-uuid.jpg",
      "11111111-1111-1111-1111-111111111111.png",
      "11111111-1111-1111-1111-111111111111.jpg.exe"
    ]) {
      const res = await get(bad)
      assert.equal(res.status, 404, `${bad} should not resolve to a file`)
    }
  })
})
