"use client"

import Link from "next/link"
import { useEffect } from "react"

/**
 * Anything that throws below the root layout lands here. Without it Next shows
 * an unstyled default page, which is a jarring way to leave the darkroom.
 */
export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-16">
      <div className="frame animate-develop">
        <p className="label">Ruined frame</p>

        <h1 className="head-2 mt-3">Something went wrong on our side.</h1>

        <p className="mt-3 text-[11px] leading-relaxed text-silver">
          Nothing you saved is affected. Try again, and if it keeps happening the digest below is the
          thing worth quoting.
        </p>

        {error.digest ? (
          <p className="mt-4 bg-gutter px-3 py-2 font-[family-name:var(--font-mono)] text-[10px] text-silver-dim shadow-[inset_0_0_0_1px_var(--line-field)]">
            {error.digest}
          </p>
        ) : null}

        <div className="section-rule my-5">
          <span>Recover</span>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={reset} className="shutter">
            Try again
          </button>
          <Link href="/app" className="ghost-btn">
            Back to the sheet
          </Link>
        </div>
      </div>
    </main>
  )
}
