import { redirect } from "next/navigation"

import { Wordmark } from "~/components/Wordmark"
import { createClient } from "~/lib/supabase/server"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-20 pt-5 sm:px-7">
      <header className="flex items-center justify-between gap-4">
        <Wordmark href="/app" />

        <div className="flex items-center gap-3">
          <span className="hidden font-[family-name:var(--font-mono)] text-xs text-rice/40 sm:inline">
            {user.email}
          </span>
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn-lacquer text-xs">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="seam mt-5" />

      {children}
    </div>
  )
}
