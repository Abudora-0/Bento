import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { hostnameOf, isoDate, normalizeUrl, parseTags, prettyPath } from "./format.ts"

describe("normalizeUrl", () => {
  it("fills in a missing scheme", () => {
    assert.equal(normalizeUrl("example.com"), "https://example.com/")
    assert.equal(normalizeUrl("example.com/a/b?x=1"), "https://example.com/a/b?x=1")
    assert.equal(normalizeUrl("example.com:8443/x"), "https://example.com:8443/x")
  })

  it("keeps what the browser would keep", () => {
    assert.equal(normalizeUrl("https://Example.COM/Path"), "https://example.com/Path")
    assert.equal(normalizeUrl("  https://a.io/x#frag  "), "https://a.io/x#frag")
    assert.equal(normalizeUrl("http://example.com:8080/x"), "http://example.com:8080/x")
  })

  it("assumes http for loopback, which is how it is actually served", () => {
    assert.equal(normalizeUrl("localhost:8080/x"), "http://localhost:8080/x")
    assert.equal(normalizeUrl("localhost"), "http://localhost/")
    assert.equal(normalizeUrl("127.0.0.1:5173"), "http://127.0.0.1:5173/")
  })

  it("refuses every scheme that is not http", () => {
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,<script>",
      "mailto:someone@example.com",
      "ftp://files.example.com/x",
      "file:///etc/passwd",
      "vbscript:msgbox"
    ]) {
      assert.equal(normalizeUrl(bad), null, `${bad} should be rejected`)
    }
  })

  it("refuses input that is not an address at all", () => {
    assert.equal(normalizeUrl("notaurl"), null)
    assert.equal(normalizeUrl(""), null)
    assert.equal(normalizeUrl("   "), null)
    assert.equal(normalizeUrl(`https://example.com/${"x".repeat(4100)}`), null)
  })
})

describe("parseTags", () => {
  it("trims, lowercases, drops the hash and dedupes", () => {
    assert.deepEqual(parseTags("React, #UI , react, ,b"), ["react", "ui", "b"])
  })

  it("splits on newlines as well as commas", () => {
    assert.deepEqual(parseTags("one\ntwo"), ["one", "two"])
  })

  it("caps the count and skips anything too long", () => {
    assert.equal(parseTags(Array.from({ length: 30 }, (_, i) => `t${i}`).join(",")).length, 12)
    assert.deepEqual(parseTags("x".repeat(33)), [])
  })
})

describe("display helpers", () => {
  it("strips www from the host", () => {
    assert.equal(hostnameOf("https://www.nytimes.com/x"), "nytimes.com")
  })

  it("falls back to the raw string when the url will not parse", () => {
    assert.equal(hostnameOf("not a url"), "not a url")
    assert.equal(prettyPath("not a url"), "")
  })

  it("keeps the path and query, drops a trailing slash", () => {
    assert.equal(prettyPath("https://a.io/b/c/?q=1"), "/b/c/?q=1")
    assert.equal(prettyPath("https://a.io/"), "/")
  })

  it("formats dates as a sortable stamp", () => {
    assert.equal(isoDate("2026-08-18T10:00:00.000Z"), "2026-08-18")
    assert.equal(isoDate("nonsense"), "")
  })
})
