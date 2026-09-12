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
import { existsSync, mkdirSync } from "node:fs"
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

/*
 * Picked for being genuinely light themed, not for being popular on their
 * own. A marketing homepage that defaults to a dark theme stays dark no
 * matter how the frame around it is tuned, brightness and opacity can only
 * push a picture so far before it stops looking like the page. Several
 * otherwise obvious choices did not make it here for exactly that reason
 * (react.dev, nextjs.org, tailwindcss.com, turso.tech, developer.mozilla.org
 * and getbootstrap.com all render dark regardless of a light colour scheme
 * request), and a few more answered with a Cloudflare bot check instead of a
 * page (npmjs.com, producthunt.com, canva.com, unsplash.com).
 *
 * Also picked for having no dark region anywhere in the captured height, not
 * only at the top. FrameShot centres this tone rather than pinning it to the
 * top, so a page with one dark panel partway down (a code sample, a screenshot
 * embedded in the page, a photograph) can still land in the crop even though
 * the page reads as bright overall.
 */
const PAGES = [
  { slug: "pypi", url: "https://pypi.org/" },
  { slug: "jest", url: "https://jestjs.io/" },
  { slug: "vue", url: "https://vuejs.org/" },
  { slug: "eslint", url: "https://eslint.org/" },
  { slug: "sqlite", url: "https://www.sqlite.org/index.html" },
  { slug: "expressjs", url: "https://expressjs.com/" },
  { slug: "typescript", url: "https://www.typescriptlang.org/" },
  { slug: "postgresql", url: "https://www.postgresql.org/" }
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
  // A handful of these sites are light by default only when the OS asks for
  // it. Without this the capture machine's own dark mode would decide.
  await tab.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }])

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
 * words, not ours, and a scraped one could carry a banned character in
 * without anyone choosing it. The host labels the components print are
 * written by hand next to the markup that uses them.
 */
console.log(`\n${taken} of ${PAGES.length} captured into public/sheet`)
