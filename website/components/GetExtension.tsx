import { EXTENSION_RELEASE_URL, installRoute } from "~/lib/links"

/**
 * How to actually get the extension.
 *
 * The site used to assume you already had it: the empty sheet said to pin it
 * to your toolbar and the settings page said to paste your token into it,
 * with nothing anywhere saying where it comes from. For anyone arriving from
 * the readme that was a dead end.
 *
 * `compact` is the one line version for the empty sheet, where the full set of
 * instructions would bury the thing the page is actually about.
 */
export function GetExtension({ compact = false }: { compact?: boolean }) {
  const route = installRoute()

  if (compact) {
    return (
      <a href={route.href} target="_blank" rel="noreferrer" className="ghost-btn mt-5 inline-block">
        {route.label}
      </a>
    )
  }

  return (
    <div className="frame">
      <div className="relative flex items-center justify-between gap-2">
        <span className="frame-no">01</span>
        <span className="frame-stamp">{route.store ? "one click" : "unpacked"}</span>
      </div>

      <h3 className="head-3 mt-3">Capture from the toolbar</h3>

      <p className="mt-2 text-[11px] leading-relaxed text-silver-dim">
        The extension puts the page you are on onto your sheet in one click, with its title, its
        icon and a screenshot. Adding by hand here works too, it just cannot take the picture.
      </p>

      <a href={route.href} target="_blank" rel="noreferrer" className="shutter mt-4 inline-block">
        {route.label}
      </a>

      {route.store ? null : (
        <>
          <p className="mt-4 text-[10px] uppercase tracking-[0.14em] text-silver-dim">Loading it</p>

          <ol className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-silver">
            <li>
              <span className="text-silver-dim">1.</span> Unzip the download.
            </li>
            <li>
              <span className="text-silver-dim">2.</span> Open{" "}
              <code className="text-print">chrome://extensions</code>, or{" "}
              <code className="text-print">edge://extensions</code>.
            </li>
            <li>
              <span className="text-silver-dim">3.</span> Switch on Developer mode, choose Load
              unpacked, and pick the unzipped folder.
            </li>
            <li>
              <span className="text-silver-dim">4.</span> Open the popup, paste this site&apos;s
              address and the token below.
            </li>
          </ol>

          <p className="mt-3 text-[10.5px] leading-relaxed text-silver-dim">
            Your browser will warn about developer mode every time it starts. That is the price of
            installing an extension from outside a store, not a sign anything is wrong. Chrome
            refuses to install a packaged <code>.crx</code> from anywhere but its own store, so
            loading the folder is the only way to sideload one.
          </p>
        </>
      )}
    </div>
  )
}

/** For the readme and anywhere else that wants the raw link. */
export { EXTENSION_RELEASE_URL }
