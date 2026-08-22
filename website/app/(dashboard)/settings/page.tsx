import type { Metadata } from "next"
import Link from "next/link"

import { ApiTokenPanel } from "~/components/ApiTokenPanel"
import { requireUser } from "~/lib/current-user"
import { isoDate } from "~/lib/format"

export const metadata: Metadata = { title: "Settings" }
export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const user = await requireUser()

  return (
    <div className="mt-6 max-w-2xl">
      <div className="section-rule">
        <span>Account</span>
      </div>

      <div className="frame mt-3">
        <div className="relative flex items-center justify-between gap-2">
          <span className="frame-no">00</span>
          <span className="frame-stamp">since {isoDate(user.created_at)}</span>
        </div>

        <h2 className="head-2 mt-3">{user.email}</h2>

        <p className="mt-2 text-[11px] leading-relaxed text-silver-dim">
          Your sheet is yours alone. Nobody else signed in here can see it, and you cannot see theirs.
        </p>
      </div>

      <div className="section-rule mt-6">
        <span>Extension</span>
      </div>

      <div className="mt-3">
        <ApiTokenPanel initialToken={user.api_token} />
      </div>

      <div className="mt-6">
        <Link href="/app" className="ghost-btn inline-block">
          Back to the sheet
        </Link>
      </div>
    </div>
  )
}
