"use client"

import Link from "next/link"
import { useEffect } from "react"

/**
 * Anything that throws below the root layout lands here. Without it Next shows
 * an unstyled default page, which is a jarring way to leave the lacquer.
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
      <div className="tray p-7 sm:p-9">
        <div className="relative">
          <p className="label-mono text-gold">A compartment cracked</p>

          <h1 className="mt-4 font-[family-name:var(--font-display)] text-2xl leading-snug text-rice">
            Something went wrong on our side.
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-rice/55">
            Nothing you saved is affected. Try again, and if it keeps happening the digest below is
            the thing worth quoting.
          </p>

          {error.digest ? (
            <p className="mt-4 rounded-lg bg-lacquer-deep/60 px-3 py-2 font-[family-name:var(--font-mono)] text-[0.6875rem] text-rice/45 shadow-[inset_0_0_0_1px_rgba(201,162,74,0.22)]">
              {error.digest}
            </p>
          ) : null}

          <div className="seam my-6" />

          <div className="flex items-center gap-2">
            <button type="button" onClick={reset} className="btn-seal text-sm">
              Try again
            </button>
            <Link href="/app" className="btn-lacquer text-sm">
              Back to the tray
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
