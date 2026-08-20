import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

/**
 * website/types/db.ts and extension/lib/types.ts are hand kept copies, because
 * the two surfaces are separate npm projects with no shared build step. Nothing
 * in either build notices when they drift, and a drifted column shows up as a
 * capture silently writing the wrong shape. So check it here.
 *
 * Only the leading comment differs, each file explains itself in its own terms.
 */

const here = dirname(fileURLToPath(import.meta.url))
const WEBSITE = resolve(here, "../types/db.ts")
const EXTENSION = resolve(here, "../../extension/lib/types.ts")

/** Everything from the first export onwards, with line endings normalised. */
function declarations(path: string): string {
  const source = readFileSync(path, "utf8").replace(/\r\n/g, "\n")
  const start = source.indexOf("export type")

  assert.notEqual(start, -1, `${path} has no exported types`)
  return source.slice(start).trim()
}

describe("mirrored database types", () => {
  it("are byte for byte the same in the website and the extension", () => {
    const website = declarations(WEBSITE)
    const extension = declarations(EXTENSION)

    if (website !== extension) {
      const a = website.split("\n")
      const b = extension.split("\n")
      const at = a.findIndex((line, i) => line !== b[i])

      assert.fail(
        `website/types/db.ts and extension/lib/types.ts have drifted, first difference on line ${at + 1}:\n` +
          `  website:   ${a[at] ?? "(missing)"}\n` +
          `  extension: ${b[at] ?? "(missing)"}\n` +
          `Change one, change the other, and change website/lib/db/schema.ts with them.`
      )
    }
  })

  it("still describe the columns the schema creates", () => {
    const source = declarations(WEBSITE)

    for (const column of [
      "url",
      "title",
      "favicon_url",
      "screenshot_url",
      "tags",
      "notes",
      "folder_id",
      "starred",
      "created_at",
      "updated_at"
    ]) {
      assert.ok(source.includes(`${column}:`), `Bookmark is missing ${column}`)
    }
  })
})
