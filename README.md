# Bento

A single user bookmark manager in two pieces. A browser extension captures the tab you are looking at, and a website lays everything you have saved out in a tray. Both talk to one SQLite file on disk, so a capture made in the extension shows up on the site as soon as you refresh.

There are no accounts. It is yours, one secret gets you in, and both surfaces share it.

## The two surfaces

**The website** is the place things get organised. It is built around a lacquered bento tray: a deep oxblood and black panel holding compartments of rice cream in varying sizes, trimmed in gold. Bigger compartments carry a screenshot, shallow ones carry a line of metadata. Headlines are set in Shippori Mincho, body copy in Zen Kaku Gothic New, and URLs, dates and tags in Space Mono.

**The extension popup** is the capture moment. It is a darkroom contact sheet: each saved tab lands as a numbered frame in a filmstrip, with sprocket holes running down both edges. Starring a frame marks it with a hand drawn red grease pencil circle rather than a generic icon. Headlines are set in Oswald, metadata in IBM Plex Mono.

The two languages are deliberately different, tied together by shared colour and type logic.

## Stack

| Piece | Built with |
| --- | --- |
| Website | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Data | SQLite, via Node's built in `node:sqlite`, one file on disk |
| Extension | Plasmo, React, TypeScript, Manifest V3, for Chrome and other Chromium browsers |

The website's own pages talk to SQLite directly from server actions, there is nothing between them. The extension cannot do that, a browser extension has no filesystem access, so it reaches a handful of api routes the website exposes instead. Those routes are the only part of this project that looks like a conventional backend.

## Repository layout

```
bento/
  website/              Next.js app
    app/                routes, server actions, the api routes the extension calls
    components/         tray, compartments, editor, folder rail
    lib/                the sqlite layer, auth, formatting, bento grid maths
    types/db.ts          hand written database types
  extension/            Plasmo extension
    popup.tsx           the contact sheet
    background.ts       keyboard shortcut capture
    lib/                config, the api client, capture and screenshotting
    scripts/            icon generator
```

## Data model

**bookmarks**: `id`, `url`, `title`, `favicon_url`, `screenshot_url`, `tags` (a JSON array), `notes`, `folder_id`, `starred`, `created_at`, `updated_at`

**folders**: `id`, `name`, `created_at`

No `user_id` on either table. There being one user is what let Supabase, and the whole idea of a managed multi tenant Postgres project, go away, see `website/lib/db/schema.ts` for the real thing.

Two details worth knowing:

- There is a unique index on `url`. Capturing a page you already saved merges into the existing row instead of making a duplicate, and the merge keeps your existing tags, note and folder.
- `folder_id` is a real foreign key with `on delete set null`, so deleting a folder unfiles the bookmarks in it rather than failing or cascading them away.

## Security model

Basic Auth in front of the website, checked in `website/middleware.ts` against one secret in the `BENTO_SECRET` environment variable. Your browser asks for it once and then remembers it for the session, that is the entire login experience, there is no account to create.

The extension cannot answer a Basic Auth prompt, so it sends the same secret as a bearer token instead, checked by each api route in `website/lib/auth.ts`. You enter it once in the popup's connect screen and it is kept in `chrome.storage.local`.

Both checks compare the secret in constant time. Pick something long and random, `openssl rand -hex 24` is a reasonable way to generate one.

## Setup

You need a Node new enough that `node:sqlite` works without the experimental flag, built and tested on Node 24. Check with `node -e "require('node:sqlite')"`, if that prints nothing you are fine.

### 1. Website

```bash
cd website
npm install
cp .env.example .env.local
```

Set `BENTO_SECRET` in `.env.local` to something long and random. Leave `BENTO_DATA_DIR` alone unless you want the database somewhere other than `website/data`, and set `NEXT_PUBLIC_SITE_URL` to wherever you will actually reach the site, it is used to build absolute screenshot urls.

Then:

```bash
npm run dev
```

The site runs at http://localhost:3000, and creates `website/data/bento.sqlite3` the first time it is asked for anything.

### 2. Extension

```bash
cd extension
npm install
npm run dev
```

Load it into the browser at `chrome://extensions`, switch on Developer mode, choose "Load unpacked" and pick `extension/build/chrome-mv3-dev`. For a production bundle run `npm run build` and load `extension/build/chrome-mv3-prod` instead.

Open the popup, it asks for two things: the site's address and the `BENTO_SECRET` you set above. It checks both before saving them.

## Using it

- **Capture**: click the Bento icon, pick a folder, add tags and a note if you want, press Capture. The popup grabs the title, URL, favicon and a screenshot of the visible part of the page.
- **Quick capture**: `Ctrl+Shift+S` (`Cmd+Shift+S` on macOS) saves the current tab without opening the popup. It files into whichever folder the popup is currently set to, so the two agree. The toolbar badge flashes to confirm.
- **Add by hand**: the site has an Add button, for pages the extension cannot reach or when it is not installed. It looks up a favicon for you server side, there is no screenshot for a typed address though, that would need actually rendering the page.
- **Star**: click the grease pencil circle in the popup, or the vermilion seal on a compartment in the tray.
- **Search**: press `/` anywhere on the tray to jump to the search field. It matches titles, addresses and notes.
- **Filter**: click a tag chip, pick a folder in the left rail, or narrow to starred only.

Chrome will not let any extension screenshot its own pages, the web store, or local files. On those pages the popup says so instead of failing quietly.

## Scripts

Website:

```bash
npm run dev         # development server
npm run build       # production build
npm run start       # run the production build
npm run test        # node:test, no framework needed
npm run typecheck   # tsc --noEmit
npm run lint
```

Extension:

```bash
npm run dev         # development build with hot reload
npm run build       # production build
npm run package     # zip for the Chrome Web Store
npm run icon        # regenerate assets/icon.png
npm run typecheck
```

The toolbar icon is generated rather than committed as an opaque binary. `scripts/make-icon.mjs` draws it with plain arithmetic and writes the PNG itself, so a change to the mark is a readable diff.

## Running it somewhere real

This needs a real, persistent disk. The database and every screenshot live as files under `BENTO_DATA_DIR`, and that will not survive on a platform with an ephemeral or read only filesystem between requests, serverless platforms in particular. It is not going on Vercel.

What it wants instead is closer to a small always on box: a cheap VPS, a Fly or Railway instance with a volume attached, a Docker container with a bind mount, a home server, anything where `website/data` is still there on the next request. Build it, set the same three environment variables as `.env.local` on that machine, and run it:

```bash
npm run build
BENTO_SECRET=... NEXT_PUBLIC_SITE_URL=https://your-domain npm run start
```

Put a reverse proxy in front for TLS, point the extension at that origin, and you are done. There is no database to provision and nothing else to stand up.

Fonts are self hosted from Fontsource rather than fetched by `next/font/google`, so the build makes no network calls for them and a clean build takes well under a minute. This is deliberate: Shippori Mincho and Zen Kaku Gothic New are split into numbered unicode range subsets that a `latin` filter does not narrow, and asking Google for them pulls over seven hundred files.

## Licence

MIT. See [LICENSE](LICENSE).
