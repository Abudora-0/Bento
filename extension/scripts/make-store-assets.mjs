/**
 * Generates the artwork an add-on store listing asks for.
 *
 * Same mark as assets/icon.png and the website, drawn once here at the sizes
 * Partner Center wants, so a listing cannot end up showing a logo the product
 * does not use.
 *
 * Run with: npm run store-assets
 * Output lands in build/store/ and is gitignored, since it is derived.
 */
import sharp from "sharp"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const OUT = resolve(ROOT, "build", "store")

mkdirSync(OUT, { recursive: true })

const GUTTER = "#050506"
const PRINT = "#e9e5dc"
const DIM = "#6d6e72"
const GREASE = "#cc352c"

/** The mark, in a 64 unit box, matching website/components/Wordmark.tsx. */
const mark = `
  <rect x="8" y="8" width="27" height="48" fill="${PRINT}"/>
  <rect x="39" y="8" width="17" height="19" fill="${DIM}"/>
  <rect x="39" y="31" width="17" height="25" fill="${PRINT}"/>
  <g transform="translate(21.5,32) scale(1.18) translate(-15,-15)">
    <path d="M20.8 5.9c4.4 1.6 6.4 6.7 4.6 11.1c-1.9 4.6-7.4 7.3-12.2 6.1C8.2 21.9 5 17.2 5.7 12.4C6.4 7.8 10.8 4.4 15.6 4.6c3.4.1 6.7 1.7 8.5 4.3c.5.8.9 1.6 1.1 2.5"
      fill="none" stroke="${GREASE}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`

/**
 * The store logo. Padded rather than bled to the edge, because these get shown
 * at small sizes inside a card with its own border and a mark touching the
 * edge reads as cropped.
 */
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="300" height="300">
  <rect width="100" height="100" fill="${GUTTER}"/>
  <svg x="18" y="18" width="64" height="64" viewBox="0 0 64 64">${mark}</svg>
</svg>`

const targets = [
  ["store-logo-300.png", logo, 300],
  ["marquee-logo-176.png", logo, 176]
]

for (const [name, svg, size] of targets) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(resolve(OUT, name))
  console.log(`wrote ${name} at ${size}x${size}`)
}

writeFileSync(resolve(OUT, "store-logo.svg"), logo)
console.log(`\nStore artwork in ${OUT}`)
console.log("Screenshots have to be taken by hand: load the extension, open the popup, capture it.")
