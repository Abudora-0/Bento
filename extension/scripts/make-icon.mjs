/**
 * Generates assets/icon.png, the toolbar icon.
 *
 * Plasmo wants a single 512x512 PNG and derives the smaller sizes from it.
 * Rather than commit a binary blob nobody can diff, the mark is drawn here in
 * plain arithmetic: a darkroom black tile holding bento compartments, one of
 * them struck in grease pencil red so the two design languages meet.
 *
 * Run with: npm run icon
 */

import { deflateSync } from "node:zlib"
import { writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "assets", "icon.png")

const SIZE = 512
const SS = 4 // supersample factor, gives clean edges without a graphics library
const BIG = SIZE * SS

// Shared palette. Darkroom ground, print cream, matcha, grease pencil red.
const DARKROOM = [13, 13, 14]
const CREAM = [233, 229, 220]
const MATCHA = [109, 127, 74]
const GREASE = [204, 53, 44]
const GOLD = [201, 162, 74]

const canvas = new Uint8Array(BIG * BIG * 4) // transparent to start

function blend(x, y, [r, g, b], alpha) {
  if (alpha <= 0 || x < 0 || y < 0 || x >= BIG || y >= BIG) return

  const i = (y * BIG + x) * 4
  const dstA = canvas[i + 3] / 255
  const outA = alpha + dstA * (1 - alpha)
  if (outA <= 0) return

  canvas[i] = (r * alpha + canvas[i] * dstA * (1 - alpha)) / outA
  canvas[i + 1] = (g * alpha + canvas[i + 1] * dstA * (1 - alpha)) / outA
  canvas[i + 2] = (b * alpha + canvas[i + 2] * dstA * (1 - alpha)) / outA
  canvas[i + 3] = outA * 255
}

/** Rounded rectangle, coordinates in 512 space. */
function roundRect(x, y, w, h, radius, color, alpha = 1) {
  const x0 = Math.round(x * SS)
  const y0 = Math.round(y * SS)
  const x1 = Math.round((x + w) * SS)
  const y1 = Math.round((y + h) * SS)
  const r = radius * SS

  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      // Distance into the nearest corner, so corners round off.
      const dx = Math.max(x0 + r - px - 0.5, px + 0.5 - (x1 - r), 0)
      const dy = Math.max(y0 + r - py - 0.5, py + 0.5 - (y1 - r), 0)

      if (dx * dx + dy * dy <= r * r) blend(px, py, color, alpha)
    }
  }
}

/** Ring, used for the grease pencil circle. */
function ring(cx, cy, radius, thickness, color, alpha = 1) {
  const c = { x: cx * SS, y: cy * SS }
  const outer = (radius + thickness / 2) * SS
  const inner = (radius - thickness / 2) * SS

  const from = { x: Math.floor(c.x - outer), y: Math.floor(c.y - outer) }
  const to = { x: Math.ceil(c.x + outer), y: Math.ceil(c.y + outer) }

  for (let py = from.y; py <= to.y; py++) {
    for (let px = from.x; px <= to.x; px++) {
      const dx = px + 0.5 - c.x
      const dy = py + 0.5 - c.y
      const d = Math.sqrt(dx * dx + dy * dy)

      if (d <= outer && d >= inner) blend(px, py, color, alpha)
    }
  }
}

// ---------------------------------------------------------------------------
// The mark
// ---------------------------------------------------------------------------

// Darkroom tile with a thin gold rim just inside the edge.
roundRect(0, 0, 512, 512, 112, DARKROOM)
roundRect(26, 26, 460, 460, 92, GOLD, 0.42)
roundRect(32, 32, 448, 448, 88, DARKROOM)

// Compartments, the bento grid.
roundRect(76, 76, 168, 200, 26, CREAM)
roundRect(268, 76, 168, 92, 26, MATCHA)
roundRect(268, 184, 168, 92, 26, CREAM)
roundRect(76, 300, 104, 136, 26, MATCHA)
roundRect(204, 300, 232, 136, 26, CREAM)

// The grease pencil pass, struck over the largest compartment.
ring(160, 176, 74, 15, GREASE, 0.95)

// ---------------------------------------------------------------------------
// Downsample and encode
// ---------------------------------------------------------------------------

const out = Buffer.alloc(SIZE * SIZE * 4)

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let r = 0
    let g = 0
    let b = 0
    let a = 0

    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const i = ((y * SS + sy) * BIG + (x * SS + sx)) * 4
        const pa = canvas[i + 3] / 255
        r += canvas[i] * pa
        g += canvas[i + 1] * pa
        b += canvas[i + 2] * pa
        a += pa
      }
    }

    const o = (y * SIZE + x) * 4
    if (a > 0) {
      out[o] = Math.round(r / a)
      out[o + 1] = Math.round(g / a)
      out[o + 2] = Math.round(b / a)
    }
    out[o + 3] = Math.round((a / (SS * SS)) * 255)
  }
}

/* -------------------------------------------------------------------------- */
/* Minimal PNG writer, RGBA 8 bit, no interlacing                              */
/* -------------------------------------------------------------------------- */

function encodePng(rgba, width, height) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)

  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filter type none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type, truecolour with alpha
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ])
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)

  const body = Buffer.concat([Buffer.from(type, "ascii"), data])

  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)

  return Buffer.concat([length, body, crc])
}

let crcTable = null

function crc32(buffer) {
  if (!crcTable) {
    crcTable = new Uint32Array(256)

    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }

  let c = 0xffffffff
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

writeFileSync(OUT, encodePng(out, SIZE, SIZE))
console.log(`wrote ${OUT}`)
