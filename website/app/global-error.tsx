"use client"

import { useEffect } from "react"

import "./globals.css"

/**
 * Last resort. This replaces the root layout entirely, so it has to bring its
 * own html and body, and it cannot rely on the fonts imported there. The
 * fallback stacks in globals.css carry it.
 */
export default function GlobalError({
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
    <html lang="en">
      <body className="antialiased">
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-16">
          <div className="tray p-7 sm:p-9">
            <div className="relative">
              <p className="label-mono text-gold">The tray would not open</p>

              <h1 className="mt-4 font-[family-name:var(--font-display)] text-2xl leading-snug text-rice">
                Bento failed to start.
              </h1>

              <p className="mt-3 text-sm leading-relaxed text-rice/55">
                This one is on us, and it happened before the page could finish loading. Reloading
                usually clears it.
              </p>

              {error.digest ? (
                <p className="mt-4 rounded-lg bg-lacquer-deep/60 px-3 py-2 font-[family-name:var(--font-mono)] text-[0.6875rem] text-rice/45 shadow-[inset_0_0_0_1px_rgba(201,162,74,0.22)]">
                  {error.digest}
                </p>
              ) : null}

              <div className="seam my-6" />

              <button type="button" onClick={reset} className="btn-seal text-sm">
                Reload
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  )
}
