import Link from "next/link"

/**
 * The way to Settings.
 *
 * There was not one. The only route was clicking your own username in the
 * header, which is a label rather than a control: it has no box, no underline
 * and no icon, it sits in the same dim silver as the inert exposure count
 * beside it, and the one hint that it goes anywhere is a title attribute that
 * says "Signed in as", which describes who you are and not where the link
 * leads. On a touch screen there is no hover, so even that was invisible.
 *
 * Drawn on the same hairline ladder as LockButton, since the two sit together
 * and one bordered control next to one borderless one is what made the old
 * arrangement read as an accident.
 */
export function SettingsButton() {
  return (
    <Link href="/settings" className="ghost-btn inline-flex items-center gap-1.5" title="Settings">
      <GearIcon />
      {/* The icon carries it on a phone, where the header has to fit the
          wordmark, a count, a name and the lock in one row. */}
      <span className="hidden sm:inline">Settings</span>
    </Link>
  )
}

/**
 * Drawn here rather than pulled from an icon set.
 *
 * Same reasoning as everything else on these two surfaces: an icon font is a
 * dependency and a network request, and this is eight lines of SVG. Matches
 * the pencil in BookmarkCell, which is drawn the same way.
 */
function GearIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <circle cx="8" cy="8" r="2.4" />
      <path
        d="M8 1.4v1.8M8 12.8v1.8M14.6 8h-1.8M3.2 8H1.4M12.7 3.3l-1.3 1.3M4.6 11.4l-1.3 1.3M12.7 12.7l-1.3-1.3M4.6 4.6 3.3 3.3"
        strokeLinecap="round"
      />
    </svg>
  )
}
