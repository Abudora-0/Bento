<div align="center">

# Bento

**A contact sheet for everything you save.**

A self hosted bookmark manager in two pieces: a browser extension that captures the tab you are looking at, and a site that lays every capture out as a frame on a contact sheet. One SQLite file on disk. No accounts, no cloud, no third party.

[![CI](https://github.com/Abudora-0/Bento/actions/workflows/ci.yml/badge.svg)](https://github.com/Abudora-0/Bento/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-c9a24a.svg)](LICENSE)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-0d0d0e.svg?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![SQLite](https://img.shields.io/badge/SQLite-node%3Asqlite-003b57.svg?logo=sqlite&logoColor=white)](https://nodejs.org/api/sqlite.html)
[![Plasmo MV3](https://img.shields.io/badge/Plasmo-MV3-cc352c.svg)](https://www.plasmo.com)
[![Tests](https://img.shields.io/badge/tests-105%20passing-78965a.svg)](#testing)

</div>

---

## What it is

Bento is a bookmark manager built around one idea: a saved page is a photograph you took of the web, so it should be filed like one. Every capture becomes a numbered frame on a contact sheet, complete with sprocket holes, a date stamp, and a hand drawn grease pencil circle on the ones worth keeping.

It runs entirely on your own machine. There is no sign up, no sync service, and nothing leaves your computer except the request that fetches a favicon.

> **Screenshots.** Drop images into `docs/` and reference them here. There is no automated capture in the repo, so this section is deliberately left for you to fill in with the real thing rather than a mockup.

## Features

- **One click capture** from the toolbar: title, URL, favicon, and a screenshot of the visible page
- **Quick capture** on `Ctrl+Shift+S`, no popup, badge flashes to confirm
- **A real lock**, not a password prompt: closes when the browser closes, after inactivity, or on demand
- **Bento grid layout**, frames in nine varying sizes rather than a uniform card wall
- **Search** across titles, addresses and notes, with `/` to focus from anywhere
- **Tags, folders and starring**, all filterable, all shareable as a URL
- **Add by hand** for pages the extension cannot reach, with a server side favicon lookup
- **Merge on re-capture**, so saving the same page twice unions its tags instead of duplicating it

## Design

Two surfaces, one design language: a darkroom contact print.

|  | |
| --- | --- |
| **Ground** | `#050506` gutter, `#0d0d0e` frames |
| **Print** | `#e9e5dc` cream, `#a9aaae` silver |
| **Accent** | `#cc352c` grease pencil red |
| **Trim** | `#c9a24a` gold, focus rings only |
| **Type** | Oswald for structure, IBM Plex Mono for everything else |

Every border is a one pixel inset hairline, never a drop shadow. Nothing has a border radius. Depth is expressed only by stepping a fixed alpha ladder, so a hover and a focus differ by a rung rather than by a new colour. Screenshots are desaturated so they read as prints, and brighten when you hover a frame, like holding a negative up to the light.

Motion follows the same metaphor. Frames develop in rather than fading, the grease pencil draws itself when you star something, the sheet advances like film between pages, and the lock screen is a bento lid that parts down the middle. All of it is plain CSS with no animation library, and all of it respects `prefers-reduced-motion`.

## Stack

| Piece | Built with |
| --- | --- |
| Website | Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4 |
| Data | SQLite through Node's built in `node:sqlite`, one file, nothing to compile |
| Extension | Plasmo, React, TypeScript, Manifest V3, Chrome and other Chromium browsers |

The site's own pages talk to SQLite directly from server actions, with nothing in between. The extension cannot do that, since a browser extension has no filesystem access, so it calls a handful of API routes instead. Those routes are the only part of this project that looks like a conventional backend.

## Security model

There is one user, so there are no accounts. Two environment variables stand in for the whole thing.

**The site** is behind a lock screen. Getting the name and secret right mints an HMAC signed session cookie, verified in middleware on every request. The cookie is `HttpOnly`, `SameSite=Lax`, `Secure` over HTTPS, and carries no expiry, which makes it a session cookie: closing the browser drops it. The signed timestamp inside it enforces the idle window, and every navigation slides that window forward.

It locks again in three ways, which together are what stop somebody else on your machine opening it:

1. Closing the browser
2. Sitting idle for `BENTO_LOCK_MINUTES`, enforced by the server as well as the tab
3. Pressing **Lock**

**The extension** cannot answer a lock screen, so it sends the same secret as a bearer token, checked separately on each API route. That path is completely independent of the cookie, which is why changing the lock never requires re-pairing the extension.

Both credentials are compared in constant time, after hashing to a fixed length so a length mismatch leaks nothing. A failed attempt never says which half was wrong.

> **What this does not do.** It locks the web interface. Anyone with filesystem access to the machine can still read `website/data/bento.sqlite3` directly. Encrypting at rest would need a key that has to live somewhere on the same disk anyway, and would break the extension's access, so it is deliberately out of scope rather than quietly implied.

## Setup

You need a Node new enough that `node:sqlite` works without an experimental flag. Built and tested on Node 24. Check with `node -e "require('node:sqlite')"`, and if that prints nothing you are fine.

### 1. The site

```bash
cd website
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | What it is |
| --- | --- |
| `BENTO_USER` | The name you type on the lock screen |
| `BENTO_SECRET` | The password, and the extension's bearer token. `openssl rand -hex 24` |
| `BENTO_LOCK_MINUTES` | Idle minutes before it locks itself. Defaults to 30 |
| `BENTO_DATA_DIR` | Where the database and screenshots live. Defaults to `./data` |
| `NEXT_PUBLIC_SITE_URL` | The origin you actually reach it on |

Then:

```bash
npm run dev
```

It runs at http://localhost:3000 and creates `website/data/bento.sqlite3` the first time it is asked for anything.

### 2. The extension

```bash
cd extension
npm install
npm run dev
```

Load it at `chrome://extensions`, switch on Developer mode, choose **Load unpacked**, and pick `extension/build/chrome-mv3-dev`. For a production bundle run `npm run build` and pick `extension/build/chrome-mv3-prod`.

Open the popup. It asks for the site's address and the same `BENTO_SECRET`, and checks both before saving them.

## Using it

- **Capture**: click the Bento icon, pick a folder, add tags and a note, press Capture
- **Quick capture**: `Ctrl+Shift+S`, or `Cmd+Shift+S` on macOS. Files into whichever folder the popup is set to
- **Add by hand**: the Add button on the site, for pages the extension cannot reach. It looks up a favicon server side. No screenshot for a typed address, that would need rendering the page
- **Star**: the grease pencil circle, in either surface
- **Search**: press `/` anywhere on the sheet
- **Filter**: click a tag, pick a folder, or narrow to marked only
- **Lock**: the Lock button in the header

Chrome will not let any extension screenshot its own pages, the web store, or local files. On those the popup says so rather than failing quietly.

## Testing

```bash
cd website
npm test
```

105 tests, using `node:test` with Node's type stripping, so there is no test framework and no extra dependency. They cover the session token and the lock middleware, URL normalisation, the SSRF guard, paging maths, query building, the mirrored type check, and all five API routes end to end against a real temporary SQLite database.

## Scripts

**Website**

```bash
npm run dev         # development server
npm run build       # production build
npm run start       # run the production build
npm test            # node:test
npm run typecheck   # tsc --noEmit
npm run lint
```

**Extension**

```bash
npm run dev         # development build with hot reload
npm run build       # production build
npm run package     # zip for the Chrome Web Store
npm run icon        # regenerate assets/icon.png
npm run typecheck
```

The toolbar icon is generated rather than committed as an opaque binary. `scripts/make-icon.mjs` draws it with plain arithmetic and writes the PNG itself, zlib deflate and CRC32 by hand, so a change to the mark is a readable diff.

## Running it somewhere real

This needs a real, persistent disk. The database and every screenshot are files under `BENTO_DATA_DIR`, and they will not survive a platform with an ephemeral or read only filesystem between requests. **It is not going on Vercel.**

What it wants is a small always on box: a cheap VPS, a Fly or Railway instance with a volume attached, a Docker container with a bind mount, or a home server. Anywhere `website/data` is still there on the next request.

```bash
npm run build
BENTO_USER=... BENTO_SECRET=... NEXT_PUBLIC_SITE_URL=https://your-domain npm run start
```

Put a reverse proxy in front for TLS, point the extension at that origin, and it is done. There is no database to provision and nothing else to stand up.

Fonts are self hosted from Fontsource rather than fetched by `next/font/google`, so the build makes no network calls for them.

## Licence

MIT. See [LICENSE](LICENSE).
