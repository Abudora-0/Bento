/**
 * Captures the pictures the landing page and the lock screen print.
 *
 * Both surfaces show a contact sheet before you have signed in, so neither can
 * use your own captures. They used to show empty frames instead, which is a
 * strange thing for a product whose whole premise is that a saved page has a
 * picture. These are genuine captures of real pages, taken the way the
 * extension takes one: the visible area of a desktop sized tab.
 *
 * Committed rather than generated at build time, because the landing page is
 * prerendered static and has to work with no browser anywhere near it.
 *
 * Needs a Chromium on the machine. Set EDGE_PATH to point at one, or let it
 * find the usual install. Run it from website/:
 *
 *   node scripts/capture-sheet.mjs
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

import puppeteer from "puppeteer-core"

const OUT = resolve(process.cwd(), "public/sheet")

/*
 * A desktop layout, then halved on the way out.
 *
 * deviceScaleFactor does the downscaling for us: the page still lays out at
 * 1280 wide, so nothing renders its mobile layout, and the file lands at
 * 640x400. The largest cell either surface draws is about 390px across, so
 * that is still enough for a retina screen, and it keeps ten committed images
 * to roughly a third of a megabyte.
 */
const VIEWPORT = { width: 1280, height: 800, deviceScaleFactor: 0.5 }
const QUALITY = 60

/** Recognisable to anyone who would run this, and none of them are ours. */
const PAGES = [
  { slug: "nextjs", url: "https://nextjs.org/" },
  { slug: "react", url: "https://react.dev/" },
  { slug: "tailwind", url: "https://tailwindcss.com/" },
  { slug: "sqlite", url: "https://www.sqlite.org/index.html" },
  { slug: "turso", url: "https://turso.tech/" },
  { slug: "mdn", url: "https://developer.mozilla.org/en-US/" },
  { slug: "typescript", url: "https://www.typescriptlang.org/" },
  { slug: "nodejs", url: "https://nodejs.org/en" },
  { slug: "lobsters", url: "https://lobste.rs/" },
  { slug: "plasmo", url: "https://www.plasmo.com/" }
]

const CANDIDATES = [
  process.env.EDGE_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/microsoft-edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium"
].filter(Boolean)

const executablePath = CANDIDATES.find((path) => existsSync(path))

if (!executablePath) {
  console.error("No Chromium found. Set EDGE_PATH to one and run this again.")
  process.exit(1)
}

mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath,
  headless: "new",
  args: ["--hide-scrollbars", "--force-color-profile=srgb"]
})

let taken = 0

for (const page of PAGES) {
  const tab = await browser.newPage()
  await tab.setViewport(VIEWPORT)

  try {
    await tab.goto(page.url, { waitUntil: "networkidle2", timeout: 45000 })
    // Long enough for a hero animation to settle, short enough to stay quick.
    await new Promise((done) => setTimeout(done, 1200))

    await tab.screenshot({
      path: resolve(OUT, `${page.slug}.jpg`),
      type: "jpeg",
      quality: QUALITY
    })

    taken += 1
    console.log(`ok    ${page.slug}`)
  } catch (err) {
    console.log(`skip  ${page.slug}  ${err.message.slice(0, 70)}`)
  } finally {
    await tab.close()
  }
}

await browser.close()

/*
 * No manifest is written on purpose. The titles these pages carry are their
 * words, not ours, and at least one of them has an em dash in it, which this
 * project does not allow anywhere. The host labels the components print are
 * written by hand next to the markup that uses them.
 */
console.log(`\n${taken} of ${PAGES.length} captured into public/sheet`)
