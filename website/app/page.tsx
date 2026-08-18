import Link from "next/link"
import { redirect } from "next/navigation"

import { Wordmark } from "~/components/Wordmark"
import { createClient } from "~/lib/supabase/server"

export default async function LandingPage() {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (user) redirect("/app")

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-8 sm:px-8">
      <header className="flex items-center justify-between">
        <Wordmark href="/" />
        <Link href="/login" className="btn-lacquer text-sm">
          Sign in
        </Link>
      </header>

      <section className="mt-20 grid gap-14 lg:mt-28 lg:grid-cols-[1.05fr_1fr] lg:items-center">
        <div>
          <p className="label-mono text-gold">Bookmark manager</p>

          <h1 className="mt-5 font-[family-name:var(--font-display)] text-[2.75rem] leading-[1.08] font-semibold text-rice sm:text-6xl">
            Everything you saved,
            <br />
            <span className="text-gold-soft">laid out in a tray.</span>
          </h1>

          <p className="mt-6 max-w-lg text-[1.0625rem] leading-relaxed text-rice/70">
            Bento is a bookmark manager in two pieces. A browser extension takes the tab you are
            looking at, title, favicon and a screenshot, and drops it straight into the tray on this
            site. Tag it, note it, file it, find it later.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/login" className="btn-seal">
              Open your tray
            </Link>
            <Link href="/login?mode=signup" className="btn-lacquer text-sm">
              Create an account
            </Link>
          </div>

          <dl className="mt-14 grid max-w-lg grid-cols-3 gap-4">
            {[
              ["01", "Capture", "One click from the toolbar"],
              ["02", "Arrange", "Tags, notes and folders"],
              ["03", "Sync", "One database, both surfaces"]
            ].map(([n, title, sub]) => (
              <div key={n}>
                <div className="label-mono text-gold/70">{n}</div>
                <div className="mt-1.5 font-[family-name:var(--font-display)] text-lg text-rice">
                  {title}
                </div>
                <div className="mt-0.5 text-[0.8125rem] leading-snug text-rice/50">{sub}</div>
              </div>
            ))}
          </dl>
        </div>

        {/* A miniature of the real tray, so the landing page shows the product. */}
        <div className="tray p-4 sm:p-5">
          <div className="relative grid grid-cols-6 auto-rows-[64px] gap-3">
            <div className="cell col-span-3 row-span-2 flex flex-col justify-between p-3.5">
              <div className="label-mono text-ink-soft">shippori mincho</div>
              <div>
                <div className="font-[family-name:var(--font-display)] text-[1.05rem] leading-tight text-ink">
                  Reading list
                </div>
                <div className="mt-1.5 flex gap-1">
                  <span className="chip">essays</span>
                  <span className="chip">later</span>
                </div>
              </div>
            </div>

            <div className="cell col-span-3 flex items-center justify-between p-3.5">
              <span className="font-[family-name:var(--font-display)] text-ink">Design refs</span>
              <span className="label-mono text-ink-soft">24</span>
            </div>

            <div className="cell col-span-2 flex items-end p-3">
              <span className="label-mono text-ink-soft">urushi.jp</span>
            </div>

            <div className="cell-empty col-span-1" />

            <div className="cell col-span-3 row-span-2 flex flex-col justify-end p-3.5">
              <div className="h-full w-full rounded-md bg-oxblood/15 shadow-[inset_0_0_0_1px_rgba(90,21,25,0.18)]" />
              <div className="mt-2.5 label-mono text-ink-soft">screenshot</div>
            </div>

            <div className="cell col-span-2 flex items-center p-3.5">
              <span className="chip">matcha</span>
            </div>

            {/* A vermilion seal, drawn rather than typed. The latin font subsets
                carry no kanji, so a glyph here would fall back unpredictably. */}
            <div className="cell col-span-1 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                <circle cx="12" cy="12" r="10" fill="#7e2024" />
                <path
                  d="M12 6.6l1.7 3.9 4.2.4-3.2 2.8.95 4.1L12 15.6l-3.65 2.2.95-4.1L6.1 10.9l4.2-.4z"
                  fill="#f3e9d6"
                />
              </svg>
            </div>

            <div className="cell col-span-4 flex items-center justify-between p-3.5">
              <span className="label-mono text-ink-soft">2026-08-18</span>
              <span className="chip-quiet text-ink! shadow-[inset_0_0_0_1px_rgba(90,21,25,0.25)]! bg-oxblood/10!">
                starred
              </span>
            </div>

            <div className="cell-empty col-span-2" />
          </div>
        </div>
      </section>

      <div className="seam mt-24" />

      <section className="mt-12 grid gap-8 sm:grid-cols-3">
        {[
          [
            "The tray",
            "Compartments in varying sizes, not a uniform card grid. Bigger wells carry screenshots, shallow ones carry a line of metadata."
          ],
          [
            "The contact sheet",
            "The extension popup is a darkroom filmstrip. Each capture lands as a numbered frame, and starring one marks it with a grease pencil circle."
          ],
          [
            "One database",
            "Supabase Postgres with row level security. Save from the extension, refresh the site, it is already there."
          ]
        ].map(([title, body]) => (
          <div key={title}>
            <h2 className="font-[family-name:var(--font-display)] text-xl text-rice">{title}</h2>
            <p className="mt-2.5 text-sm leading-relaxed text-rice/60">{body}</p>
          </div>
        ))}
      </section>

      <footer className="mt-24 flex flex-wrap items-center justify-between gap-4">
        <span className="label-mono text-rice/35">Bento, MIT licensed</span>
        <Link href="/login" className="label-mono text-gold hover:text-gold-soft">
          Sign in
        </Link>
      </footer>
    </main>
  )
}
