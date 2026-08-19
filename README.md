# Bento

A multi user bookmark manager in two pieces. A browser extension captures the tab you are looking at, and a website lays everything you have saved out in a tray. Both talk to the same Supabase project, so a capture made in the extension shows up on the site as soon as you refresh.

## The two surfaces

**The website** is the place things get organised. It is built around a lacquered bento tray: a deep oxblood and black panel holding compartments of rice cream in varying sizes, trimmed in gold. Bigger compartments carry a screenshot, shallow ones carry a line of metadata. Headlines are set in Shippori Mincho, body copy in Zen Kaku Gothic New, and URLs, dates and tags in Space Mono.

**The extension popup** is the capture moment. It is a darkroom contact sheet: each saved tab lands as a numbered frame in a filmstrip, with sprocket holes running down both edges. Starring a frame marks it with a hand drawn red grease pencil circle rather than a generic icon. Headlines are set in Oswald, metadata in IBM Plex Mono.

The two languages are deliberately different, tied together by shared colour and type logic.

## Stack

| Piece | Built with |
| --- | --- |
| Website | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, deployed on Vercel |
| Backend | Supabase: Postgres, Auth, Storage, Row Level Security |
| Extension | Plasmo, React, TypeScript, Manifest V3, for Chrome and other Chromium browsers |

Both surfaces reach Supabase through the JavaScript client SDK. There is no separate API server.

## Repository layout

```
bento/
  website/              Next.js app
    app/                routes, server actions
    components/         tray, compartments, editor, folder rail
    lib/                supabase clients, formatting, bento grid maths
    types/db.ts         hand written database types
  extension/            Plasmo extension
    popup.tsx           the contact sheet
    background.ts       keyboard shortcut capture
    lib/                supabase client, capture and upload
    scripts/            icon generator
  supabase/
    migrations/         schema, RLS policies, storage bucket
```

## Data model

**bookmarks**: `id`, `user_id`, `url`, `title`, `favicon_url`, `screenshot_url`, `tags` (text array), `notes`, `folder_id`, `starred`, `created_at`, `updated_at`

**folders**: `id`, `user_id`, `name`, `created_at`

Row Level Security is on for both tables, and every policy keys off `auth.uid() = user_id`, so a user can only ever reach their own rows. Screenshots live in a public `screenshots` storage bucket, written under a per user folder that the storage policies enforce.

Two details worth knowing:

- There is a unique index on `(user_id, url)`. Capturing a page you already saved merges into the existing row instead of making a duplicate, and the merge keeps your existing tags, note and folder.
- A trigger checks that any `folder_id` you set actually belongs to you, which RLS alone would not catch.

## Setup

You need Node 20 or newer and a Supabase project.

### 1. Database

Run `supabase/migrations/0001_init.sql` against your project. Either paste it into the SQL editor in the Supabase dashboard, or use the CLI:

```bash
supabase db push
```

The migration is idempotent, so running it twice is safe.

### 2. Website

```bash
cd website
npm install
cp .env.example .env.local
```

Fill in `.env.local` from Project Settings, API in the Supabase dashboard:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Then:

```bash
npm run dev
```

The site runs at http://localhost:3000.

### 3. Extension

```bash
cd extension
npm install
cp .env.example .env.local
```

Fill in the same project details, with Plasmo's prefix:

```
PLASMO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
PLASMO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
PLASMO_PUBLIC_SITE_URL=http://localhost:3000
```

Then:

```bash
npm run dev
```

Load it into the browser at `chrome://extensions`, switch on Developer mode, choose "Load unpacked" and pick `extension/build/chrome-mv3-dev`. For a production bundle run `npm run build` and load `extension/build/chrome-mv3-prod` instead.

### 4. Auth redirect

Under Authentication, URL Configuration in the Supabase dashboard, add `http://localhost:3000/auth/callback` to the redirect allow list, plus your deployed origin once you have one.

## Using it

Sign up on the website, then sign in with the same account inside the extension popup. The two share one database, that is the whole point.

- **Capture**: click the Bento icon, pick a folder, add tags and a note if you want, press Capture. The popup grabs the title, URL, favicon and a screenshot of the visible part of the page.
- **Quick capture**: `Ctrl+Shift+S` (`Cmd+Shift+S` on macOS) saves the current tab without opening the popup. It files into whichever folder the popup is currently set to, so the two agree. The toolbar badge flashes to confirm.
- **Add by hand**: the site has an Add button, for pages the extension cannot reach or when it is not installed.
- **Star**: click the grease pencil circle in the popup, or the vermilion seal on a compartment in the tray.
- **Search**: press `/` anywhere on the tray to jump to the search field. It matches titles, addresses and notes.
- **Filter**: click a tag chip, pick a folder in the left rail, or narrow to starred only.

Chrome will not let any extension screenshot its own pages, the web store, or local files. On those pages the popup says so instead of failing quietly.

## Scripts

Website:

```bash
npm run dev         # development server
npm run build       # production build
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

## Deploying the website

Point Vercel at this repository and set the root directory to `website`. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SITE_URL` (your deployed origin) as environment variables. The default build command is correct.

Note that Shippori Mincho and Zen Kaku Gothic New ship a large number of unicode range subsets, so the first build spends a while fetching fonts. Only the weights actually used by the design are requested, which keeps that in check.

## Licence

MIT. See [LICENSE](LICENSE).
