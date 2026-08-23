# Edge Add-ons submission

Everything the Partner Center form asks for, written out so it is copy and paste rather than invention on the day.

Submit at <https://partner.microsoft.com/dashboard/microsoftedge/overview>. Registration is free, there is no developer fee, and the same Chromium MV3 zip that goes on a GitHub release is the one to upload.

## The package

```bash
cd extension
npm run build      # production bundle
npm run package    # build/chrome-mv3-prod.zip, this is what gets uploaded
```

Version comes from `package.json`. Bump it before every resubmission, since the store refuses a package whose version it has already seen.

## Artwork

```bash
npm run store-assets   # build/store/
```

| Asset | Size | Where it comes from |
| --- | --- | --- |
| Store logo | 300x300 PNG | `build/store/store-logo-300.png` |
| Small promo tile | 176x176 PNG | `build/store/marquee-logo-176.png` |
| Screenshots | at least one, 1366x768 | **You have to take these.** See below. |

Confirm the exact sizes against Partner Center when you submit. They have changed before, and the generator is two lines to adjust.

**Screenshots are the one thing that cannot be generated.** Load the extension, sign in to your Bento, and capture: the popup with a page ready to save, the popup's folder picker open, and the sheet on the website with a few frames on it. Three is plenty.

## Listing copy

**Name**

```
Bento
```

**Short description** (132 characters maximum, this is 117)

```
Capture the tab you are looking at onto a contact sheet. Pairs with your own self hosted Bento, not with our servers.
```

**Description**

```
Bento is a bookmark manager that treats a saved page like a photograph you took of the web. Every capture becomes a numbered frame on a contact sheet: a screenshot, the page title, its icon, the date, and a grease pencil circle on the ones worth keeping.

This extension is half of it. The other half is the Bento site, which you host yourself. The extension talks only to the address you give it, so your bookmarks live on your deployment and nowhere else. There is no Bento account, no Bento server, and nothing to sign up for here.

What it does

- Capture the current tab in one click: title, address, icon and a screenshot of the visible page
- Quick capture on Ctrl+Shift+S, or Command+Shift+S, without opening the popup
- Choose a folder before saving, remembered between captures
- Star a capture straight from the popup
- Re-capturing a page you already saved merges into it rather than making a second copy

Setting it up

1. Deploy Bento, or get the address of one you already have. Instructions are at github.com/Abudora-0/Bento
2. Sign in and open Settings to find your extension token
3. Open this extension's popup and paste in the address and the token

Permissions

activeTab, tabs and storage, and no host permissions at all. It reads the tab only when you press capture, never in the background.

Open source under the MIT licence at github.com/Abudora-0/Bento
```

**Category**

```
Productivity
```

**Language**

```
English (United States)
```

## Properties

| Field | Value |
| --- | --- |
| Privacy policy URL | `https://github.com/Abudora-0/Bento#privacy` |
| Website | `https://github.com/Abudora-0/Bento` |
| Support contact | your email, or `https://github.com/Abudora-0/Bento/issues` |
| Does it collect personally identifiable information? | **No** |

## Why the permissions look the way they do

Reviewers ask about permissions, and these are worth being able to explain in a sentence each.

- **`activeTab`** reads the title, address and icon of the tab you are on, and only in response to you pressing capture or the shortcut.
- **`tabs`** finds which tab is active, and is what the keyboard shortcut needs since it fires with no popup open.
- **`storage`** keeps two values in `chrome.storage.local`: the site address and the token. Nothing else, and neither is sent anywhere except to that address.
- **No host permissions.** Requests to your Bento work because its API answers with CORS headers, so the browser allows them without the extension asking for access to every site. This is the reason not to add `<all_urls>` later without thinking hard about it: it would widen the listing's permission warning from nothing to everything.

## What review usually asks

- **What the extension is for**, when it needs a server the store cannot see. The short description leads with "your own self hosted Bento" for exactly this reason.
- **Why it takes screenshots.** Only of the visible area, only of the tab you are on, only when you press the button, and it goes to your own deployment.

## After it is live

Set `NEXT_PUBLIC_EXTENSION_STORE_URL` on the website's deployment to the listing url. The install panel on `/settings` and the empty sheet both switch from the download and unzip instructions to a one click install on their own. See `website/lib/links.ts`.
