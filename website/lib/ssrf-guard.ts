/**
 * Blocks outbound requests from landing on this machine's own network.
 *
 * Only one feature makes the server fetch a user supplied url on its own
 * initiative, the favicon lookup for a manually added bookmark, see
 * lib/favicon.ts. Only a signed in account can reach the form that triggers it,
 * so the realistic threat here is narrow, but "paste a URL, the server fetches
 * it" is exactly the shape of request that can be pointed at
 * 169.254.169.254 or an internal admin panel if this check is not here.
 */

const IPV4_BLOCKS: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link local, this is where cloud metadata endpoints live
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
  ["255.255.255.255", 32]
]

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".")
  if (parts.length !== 4) return null

  let value = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const n = Number(part)
    if (n > 255) return null
    value = (value << 8) | n
  }
  return value >>> 0
}

function isBlockedIpv4(ip: string): boolean {
  const target = ipv4ToInt(ip)
  if (target === null) return true // could not parse, refuse rather than guess

  for (const [base, bits] of IPV4_BLOCKS) {
    const baseInt = ipv4ToInt(base)
    if (baseInt === null) continue

    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
    if ((target & mask) === (baseInt & mask)) return true
  }

  return false
}

/** Prefixes covering loopback, unspecified, link local and unique local IPv6. */
const IPV6_BLOCKED_PREFIXES = ["::1", "::", "fe80:", "fec0:", "fc", "fd"]

function isBlockedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase()

  if (normalized === "::1" || normalized === "::") return true

  // An IPv4 address embedded in an IPv6 one, ::ffff:a.b.c.d, inherits the v4 rules.
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(normalized)
  if (mapped) return isBlockedIpv4(mapped[1])

  for (const prefix of IPV6_BLOCKED_PREFIXES) {
    if (normalized.startsWith(prefix)) return true
  }

  return false
}

export function isBlockedAddress(ip: string, family: 4 | 6): boolean {
  return family === 4 ? isBlockedIpv4(ip) : isBlockedIpv6(ip)
}
