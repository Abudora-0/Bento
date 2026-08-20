import Link from "next/link"

import { Wordmark } from "~/components/Wordmark"

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-16">
      <div className="frame animate-develop">
        <Wordmark href="/app" size="lg" />

        <div className="perf-strip mt-4" aria-hidden />

        {/* An unexposed strip, which is the whole joke. */}
        <div className="mt-6 grid grid-cols-3 gap-2" aria-hidden>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="frame-blank h-12" style={{ opacity: 0.3 + (i % 3) * 0.2 }} />
          ))}
        </div>

        <p className="label mt-7">Frame 404</p>

        <h1 className="head-2 mt-3">Nothing was exposed here.</h1>

        <p className="mt-3 text-[11px] leading-relaxed text-silver">
          There is nothing at that address. It may have been deleted, or the link may have been
          mistyped.
        </p>

        <div className="section-rule my-5">
          <span>Go back</span>
        </div>

        <Link href="/app" className="shutter inline-block">
          Open the sheet
        </Link>
      </div>
    </main>
  )
}
