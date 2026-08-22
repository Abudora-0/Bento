import Link from "next/link"

import { IdleWatcher } from "~/components/IdleWatcher"
import { LockButton } from "~/components/LockButton"
import { ExposureCount, Wordmark } from "~/components/Wordmark"
import { requireUser } from "~/lib/current-user"
import { countBookmarks } from "~/lib/db/bookmarks"
import { idleTimeoutMs } from "~/lib/session"

/**
 * middleware.ts already turned away anyone without a valid session before this
 * renders, so there is no check to repeat here. What it does add is the film
 * leader across the top and the two halves of the lock: a button to close it
 * by hand and a watcher that closes it after a stretch of no activity.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-20 pt-5 sm:px-7">
      <header className="flex items-center justify-between gap-4">
        <Wordmark href="/app" />

        <div className="flex items-center gap-3">
          <ExposureCount count={await countBookmarks(user.id)} />
          <Link href="/settings" className="ghost" title={user.email}>
            Settings
          </Link>
          <LockButton />
        </div>
      </header>

      <div className="perf-strip mt-3" aria-hidden />

      {children}

      <IdleWatcher timeoutMs={idleTimeoutMs()} />
    </div>
  )
}
