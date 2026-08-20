"use client"

import { useEffect } from "react"

import "./globals.css"

/**
 * Last resort. This replaces the root layout entirely, so it has to bring its
 * own html and body, and it cannot rely on the fonts imported there. The
 * fallback stacks in --font-head and --font-mono carry it.
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
          <div className="frame">
            <p className="label">The roll jammed</p>

            <h1 className="head-2 mt-3">Bento failed to start.</h1>

            <p className="mt-3 text-[11px] leading-relaxed text-silver">
              This one is on us, and it happened before the page could finish loading. Reloading
              usually clears it.
            </p>

            {error.digest ? (
              <p className="mt-4 bg-gutter px-3 py-2 font-[family-name:var(--font-mono)] text-[10px] text-silver-dim shadow-[inset_0_0_0_1px_var(--line-field)]">
                {error.digest}
              </p>
            ) : null}

            <div className="section-rule my-5">
              <span>Recover</span>
            </div>

            <button type="button" onClick={reset} className="shutter">
              Reload
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
