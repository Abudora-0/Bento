import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { secretsMatch } from "./auth.ts"

describe("secretsMatch", () => {
  it("matches identical strings", async () => {
    assert.equal(await secretsMatch("correct horse battery staple", "correct horse battery staple"), true)
  })

  it("rejects anything different", async () => {
    assert.equal(await secretsMatch("correct horse battery staple", "wrong"), false)
  })

  it("rejects a value that only differs by one character", async () => {
    assert.equal(await secretsMatch("abcdefgh", "abcdefgi"), false)
  })

  it("rejects a prefix of the real secret", async () => {
    assert.equal(await secretsMatch("abcdefgh", "abcdefg"), false)
  })

  it("is not fooled by an empty string", async () => {
    assert.equal(await secretsMatch("", "abcdefgh"), false)
    assert.equal(await secretsMatch("", ""), true)
  })
})
