import Link from "next/link"

import { CommandPalette } from "~/components/CommandPalette"
import { IdleWatcher } from "~/components/IdleWatcher"
import { LockButton } from "~/components/LockButton"
import { ExposureCount, Wordmark } from "~/components/Wordmark"
import { requireUser } from "~/lib/current-user"
import { countBookmarks } from "~/lib/db/bookmarks"
import { listFolders } from "~/lib/db/folders"
import { idleTimeoutMs } from "~/lib/session"

/**
 * middleware.ts already turned away anyone without a valid session before this
 * renders, so there is no check to repeat here. What it does add is the film
 * leader across the top and the two halves of the lock: a button to close it
 * by hand and a watcher that closes it after a stretch of no activity.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()

  /*
   * The palette needs folders on every page, not just the sheet, so it is read
   * here. Two round trips rather than one, which is the price of the palette
   * working on /settings as well, and it is a small indexed read.
   */
  const [count, paletteFolders] = await Promise.all([countBookmarks(user.id), listFolders(user.id)])

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-20 pt-5 sm:px-7">
      <header className="flex items-center justify-between gap-4">
        <Wordmark href="/app" />

        <div className="flex items-center gap-3">
          <ExposureCount count={count} />
          <Link
            href="/settings"
            className="ghost max-w-[9rem] truncate"
            title={`Signed in as ${user.username}`}
          >
            {user.username}
          </Link>
          <LockButton />
        </div>
      </header>

      <div className="perf-strip mt-3" aria-hidden />

      {children}

      <CommandPalette folders={paletteFolders} tags={[]} />

      <IdleWatcher timeoutMs={idleTimeoutMs()} />
    </div>
  )
}
