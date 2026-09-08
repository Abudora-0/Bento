/**
 * Takes the screenshots the readme shows.
 *
 * Committed rather than kept as a scratch file, because the images are
 * committed too and a picture nobody can regenerate goes stale the first time
 * the design moves. This is what took the ones in docs/.
 *
 * Two things about how it works are deliberate.
 *
 * It runs against a production build rather than the dev server, because the
 * dev overlay badge otherwise sits in the corner of every shot.
 *
 * It mints a session with the app's own issueSession rather than driving the
 * sign in form, so no password has to live in a script or an environment
 * variable to take a picture of a page. lib/session.ts imports nothing, so
 * Node reads it directly with type stripping.
 *
 * Start the build first, then:
 *
 *   npm run build && npm run start -- -p 3100
 *   node --env-file-if-exists=.env.local scripts/capture-docs.mjs http://localhost:3100
 */
import { createClient } from "@libsql/client"
import { existsSync, mkdirSync } from "node:fs"
import { resolve } from "node:path"

import puppeteer from "puppeteer-core"

import { SESSION_COOKIE, issueSession } from "../lib/session.ts"

const ORIGIN = process.argv[2] ?? "http://localhost:3100"
const OUT = resolve(process.cwd(), "../docs")

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

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
})

const { rows } = await db.execute("select id from users order by created_at asc limit 1")
if (rows.length === 0) {
  console.error("No account in that database. Sign up on the site first.")
  process.exit(1)
}

const token = await issueSession(String(rows[0].id))
const { hostname } = new URL(ORIGIN)

mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath,
  headless: "new",
  args: ["--hide-scrollbars", "--force-color-profile=srgb"]
})

/*
 * fullPage on the landing page only. Everywhere else a fixed height is the
 * point: the sheet and the lock are meant to be seen as one screenful, and a
 * full page shot of a long roll says nothing a short one does not.
 */
const SHOTS = [
  { file: "landing.png", path: "/", width: 1400, height: 1000, fullPage: true, signedIn: false },
  { file: "lock.png", path: "/lock", width: 1400, height: 720, signedIn: false },
  { file: "sheet.png", path: "/app", width: 1400, height: 900 },
  { file: "arrange.png", path: "/app?sort=custom", width: 1400, height: 900 }
]

for (const shot of SHOTS) {
  const tab = await browser.newPage()
  await tab.setViewport({ width: shot.width, height: shot.height, deviceScaleFactor: 1 })

  if (shot.signedIn !== false) {
    await tab.setCookie({ name: SESSION_COOKIE, value: token, domain: hostname, path: "/" })
  }

  await tab.goto(`${ORIGIN}${shot.path}`, { waitUntil: "networkidle2", timeout: 45000 })

  /*
   * Long enough for the frames to finish developing in. Every cell is on a
   * staggered delay, so a shot taken too early catches half a sheet mid
   * animation, which looks like a rendering fault rather than a design.
   */
  await new Promise((done) => setTimeout(done, 2200))

  await tab.screenshot({ path: resolve(OUT, shot.file), fullPage: Boolean(shot.fullPage) })
  console.log(`ok    ${shot.file}  ${shot.path}`)
  await tab.close()
}

await browser.close()
console.log(`\n${SHOTS.length} written into docs/`)
