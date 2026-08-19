import Link from "next/link"

import { Wordmark } from "~/components/Wordmark"

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-16">
      <div className="tray p-7 sm:p-9">
        <div className="relative">
          <Wordmark href="/" size="lg" />

          {/* An empty well, which is the whole joke. */}
          <div className="mt-8 grid grid-cols-3 gap-2.5" aria-hidden>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="cell-empty h-12" style={{ opacity: 0.3 + (i % 3) * 0.2 }} />
            ))}
          </div>

          <p className="label-mono mt-8 text-gold">404</p>

          <h1 className="mt-3 font-[family-name:var(--font-display)] text-2xl leading-snug text-rice">
            This compartment is empty.
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-rice/55">
            There is nothing at that address. It may have been deleted, or the link may have been
            mistyped.
          </p>

          <div className="seam my-6" />

          <div className="flex items-center gap-2">
            <Link href="/app" className="btn-seal text-sm">
              Open your tray
            </Link>
            <Link href="/" className="btn-lacquer text-sm">
              Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
