import { Wordmark } from "~/components/Wordmark"

/**
 * middleware.ts already turned away anyone without the shared secret before
 * this ever renders, so there is no session to check here, and nothing to
 * sign out of, Basic Auth credentials just live in the browser until it is
 * closed.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-20 pt-5 sm:px-7">
      <header className="flex items-center justify-between gap-4">
        <Wordmark href="/app" />
      </header>

      <div className="seam mt-5" />

      {children}
    </div>
  )
}
