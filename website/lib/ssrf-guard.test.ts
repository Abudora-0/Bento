import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { isBlockedAddress } from "./ssrf-guard.ts"

describe("isBlockedAddress, ipv4", () => {
  it("blocks loopback", () => {
    assert.equal(isBlockedAddress("127.0.0.1", 4), true)
    assert.equal(isBlockedAddress("127.255.255.255", 4), true)
  })

  it("blocks the cloud metadata address specifically", () => {
    assert.equal(isBlockedAddress("169.254.169.254", 4), true)
  })

  it("blocks the private ranges", () => {
    assert.equal(isBlockedAddress("10.0.0.1", 4), true)
    assert.equal(isBlockedAddress("172.16.0.1", 4), true)
    assert.equal(isBlockedAddress("172.31.255.255", 4), true)
    assert.equal(isBlockedAddress("192.168.1.1", 4), true)
  })

  it("blocks CGNAT and the documentation and benchmarking ranges", () => {
    assert.equal(isBlockedAddress("100.64.0.1", 4), true)
    assert.equal(isBlockedAddress("192.0.2.1", 4), true)
    assert.equal(isBlockedAddress("198.51.100.1", 4), true)
    assert.equal(isBlockedAddress("203.0.113.1", 4), true)
  })

  it("blocks multicast, reserved and broadcast", () => {
    assert.equal(isBlockedAddress("224.0.0.1", 4), true)
    assert.equal(isBlockedAddress("240.0.0.1", 4), true)
    assert.equal(isBlockedAddress("255.255.255.255", 4), true)
  })

  it("does not block ordinary public addresses", () => {
    assert.equal(isBlockedAddress("8.8.8.8", 4), false)
    assert.equal(isBlockedAddress("1.1.1.1", 4), false)
    assert.equal(isBlockedAddress("93.184.216.34", 4), false)
  })

  it("does not block addresses that merely resemble a blocked one", () => {
    // 172.32.0.0 is one step outside the 172.16.0.0/12 private range.
    assert.equal(isBlockedAddress("172.32.0.1", 4), false)
    // 11.0.0.0 is not inside 10.0.0.0/8.
    assert.equal(isBlockedAddress("11.0.0.1", 4), false)
  })

  it("refuses to guess on something unparseable", () => {
    assert.equal(isBlockedAddress("not.an.ip.address", 4), true)
  })
})

describe("isBlockedAddress, ipv6", () => {
  it("blocks loopback and unspecified", () => {
    assert.equal(isBlockedAddress("::1", 6), true)
    assert.equal(isBlockedAddress("::", 6), true)
  })

  it("blocks link local and unique local", () => {
    assert.equal(isBlockedAddress("fe80::1", 6), true)
    assert.equal(isBlockedAddress("fc00::1", 6), true)
    assert.equal(isBlockedAddress("fd12:3456::1", 6), true)
  })

  it("unwraps an ipv4 mapped address and applies the ipv4 rules", () => {
    assert.equal(isBlockedAddress("::ffff:127.0.0.1", 6), true)
    assert.equal(isBlockedAddress("::ffff:169.254.169.254", 6), true)
    assert.equal(isBlockedAddress("::ffff:8.8.8.8", 6), false)
  })

  it("does not block an ordinary public ipv6 address", () => {
    assert.equal(isBlockedAddress("2606:4700:4700::1111", 6), false)
  })
})
