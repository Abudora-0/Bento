import type { Metadata } from "next"
import Link from "next/link"

import { GetExtension } from "~/components/GetExtension"
import { Letters, Mark } from "~/components/Wordmark"
import { REPO_URL, installRoute } from "~/lib/links"

/**
 * The front page.
 *
 * This used to redirect straight to /app, on the reasoning that a shared
 * secret gated everything so a landing page had nothing left to sell. Accounts
 * killed that reasoning: there is a real sign up now, and nothing was pointing
 * at it. A stranger opening the deployed url got "Closed, everything you saved
 * is behind this", which explains nothing and is addressed to somebody who
 * already has an account.
 *
 * Public, see PUBLIC_PATHS in middleware.ts. Anyone already signed in is sent
 * to their sheet rather than made to walk past the pitch again.
 */
export const metadata: Metadata = {
  title: { absolute: "Bento, a contact sheet for everything you save" },
  description:
    "A self hosted bookmark manager in two pieces: a browser extension that captures the tab you are on, and a site that lays every capture out as a frame on a contact sheet."
}

export default function Landing() {
  /*
   * This page is prerendered, so the code is read at build rather than per
   * request. That is fine and deliberate: changing an environment variable on
   * Vercel triggers a redeploy anyway, so there is no window where the two
   * disagree, and a static landing page costs no function invocation. It also
   * means the code ends up in static html, which is what publishing it in the
   * readme already decided.
   */
  const inviteCode = process.env.BENTO_INVITE_CODE ?? null

  return (
    <main className="mx-auto w-full max-w-[1100px] px-5 pb-24 pt-10 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <span className="wordmark flex items-center gap-3">
          <Mark className="h-9 w-9 shrink-0" animate />
          <span className="block h-[22px] text-print">
            <Letters />
          </span>
        </span>

        <nav className="flex items-center gap-2">
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="ghost-btn">
            Source
          </a>
          <Link href="/lock" className="ghost-btn">
            Sign in
          </Link>
        </nav>
      </header>

      <div className="perf-strip mt-5" aria-hidden />

      {/* ------------------------------------------------------------------ */}
      {/* The pitch                                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-12 grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-center">
        <div>
          <p className="label">A contact sheet for everything you save</p>

          <h1 className="mt-4 max-w-[20ch] text-balance font-[family-name:var(--font-head)] text-[34px] font-medium uppercase leading-[1.08] tracking-[0.02em] text-print sm:text-[44px]">
            {/* One run of text, wrapped by a max width rather than a break.
                A <br> and adjacent block spans both concatenate without a
                space in the accessible name, so a screen reader was reading
                "photographyou took of the web". */}
            A saved page is a photograph you took of the web
          </h1>

          <p className="mt-5 max-w-md text-[12.5px] leading-relaxed text-silver">
            So Bento files it like one. Every capture becomes a numbered frame on a contact sheet,
            with a screenshot, the date, and a grease pencil circle on the ones worth keeping.
          </p>

          <p className="mt-3 max-w-md text-[11px] leading-relaxed text-silver-dim">
            Two pieces: a browser extension that captures the tab you are on, and this site, which
            lays them out. You host it, so the bookmarks are yours.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-2">
            <Link href="/lock?new=1" className="shutter">
              Create an account
            </Link>
            <Link href="/lock" className="ghost-btn">
              I have one already
            </Link>
          </div>

          {inviteCode ? (
            <p className="mt-4 text-[11px] leading-relaxed text-silver-dim">
              Signup asks for an invite code. It is{" "}
              <code className="bg-gutter px-1.5 py-0.5 text-print shadow-[inset_0_0_0_1px_var(--line-field)]">
                {inviteCode}
              </code>
              , published on purpose: it keeps automated signups off a free tier, not people.
            </p>
          ) : null}
        </div>

        <ContactSheetPreview />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* What it does                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="section-rule mt-20">
        <span>What it does</span>
      </div>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            no: "01",
            head: "Capture in one click",
            body: "The extension saves the tab you are on: title, address, icon, and a screenshot of what you were looking at."
          },
          {
            no: "02",
            head: "Laid out as a sheet",
            body: "Frames in nine varying sizes rather than a uniform card wall, so a sheet reads like a sheet and not a spreadsheet."
          },
          {
            no: "03",
            head: "Search, tag, file",
            body: "Folders, tags and starring, all filterable and all shareable as a url. A loupe for looking closer, and a palette for getting anywhere."
          },
          {
            no: "04",
            head: "Yours alone",
            body: "Accounts are scoped in SQL rather than filtered in code, so two people on one deployment never see each other's sheets."
          }
        ].map((item) => (
          <div key={item.no} className="frame">
            <span className="frame-no">{item.no}</span>
            <h2 className="head-3 mt-3">{item.head}</h2>
            <p className="mt-2 text-[11px] leading-relaxed text-silver-dim">{item.body}</p>
          </div>
        ))}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* The extension                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="section-rule mt-14">
        <span>The other half</span>
      </div>

      <section className="mt-4 max-w-2xl">
        <GetExtension />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* The design, which for a project like this is part of the pitch     */}
      {/* ------------------------------------------------------------------ */}
      <div className="section-rule mt-14">
        <span>Built like a darkroom</span>
      </div>

      <section className="mt-4 grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-start">
        <p className="max-w-xl text-[11.5px] leading-relaxed text-silver-dim">
          One design language across the extension and the site. Every border is a one pixel inset
          hairline, never a drop shadow. Nothing has a border radius. Depth is a fixed alpha ladder,
          so a hover and a focus differ by a rung rather than by a new colour. Nothing on the page is
          a browser default: the dropdowns, the checkboxes and the scrollbars are all drawn, because
          one native control is enough to make a design look unfinished.
        </p>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10.5px]">
          {[
            ["Ground", "#050506"],
            ["Print", "#e9e5dc"],
            ["Grease", "#cc352c"],
            ["Trim", "#c9a24a"]
          ].map(([name, hex]) => (
            <div key={name} className="flex items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 shadow-[inset_0_0_0_1px_var(--line-live)]"
                style={{ background: hex }}
                aria-hidden
              />
              <dt className="text-silver-dim">{name}</dt>
              <dd className="ml-auto text-silver tabular-nums">{hex}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/*
        The tail of the roll. The perforation strip bookends the one under the
        header, and the last line is the edge printing that runs along real
        film stock: the stock name, the roll, and the frame numbers with the
        little arrow between them.
      */}
      <footer className="mt-20">
        <div className="perf-strip" aria-hidden />

        <div className="mt-7 grid gap-8 sm:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <span className="flex items-center gap-2.5">
              <Mark className="h-6 w-6 shrink-0" />
              <span className="block h-[15px] text-print">
                <Letters animate={false} />
              </span>
            </span>

            <p className="mt-3 max-w-[30ch] text-[10.5px] leading-relaxed text-silver-dim">
              A contact sheet for everything you save. Self hosted, so the bookmarks stay yours.
            </p>
          </div>

          <nav aria-label="The project">
            <p className="label">The project</p>
            <ul className="mt-3 space-y-2">
              {[
                { label: "Source", href: REPO_URL },
                { label: "Releases", href: `${REPO_URL}/releases` },
                { label: "Privacy", href: `${REPO_URL}#privacy` },
                { label: "MIT licence", href: `${REPO_URL}/blob/main/LICENSE` }
              ].map((link) => (
                <li key={link.label}>
                  <a href={link.href} target="_blank" rel="noreferrer" className="footer-link">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Getting started">
            <p className="label">Get started</p>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/lock?new=1" className="footer-link">
                  Create an account
                </Link>
              </li>
              <li>
                <Link href="/lock" className="footer-link">
                  Sign in
                </Link>
              </li>
              <li>
                <a href={installRoute().href} target="_blank" rel="noreferrer" className="footer-link">
                  {installRoute().store ? "Add the extension" : "Download the extension"}
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-9 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 pt-4 shadow-[inset_0_1px_0_var(--line-frame)]">
          <span className="frame-stamp">Bento 400, roll 01, MIT</span>
          <span className="flex items-center gap-2 frame-stamp" aria-hidden>
            <span>24</span>
            <span className="text-grease">&#9656;</span>
            <span>24A</span>
            <span className="text-grease">&#9656;</span>
            <span>25</span>
          </span>
        </div>
      </footer>
    </main>
  )
}

/**
 * The product, shown rather than described.
 *
 * A still arrangement of frames rather than a screenshot, so it cannot go
 * stale, needs no asset, and is drawn from the same classes the real sheet
 * uses. Decorative, so it is hidden from assistive technology, and the shapes
 * are fixed rather than random because a value that differs between the server
 * render and the client one is a hydration mismatch.
 */
function ContactSheetPreview() {
  const cells = [
    { span: 4, tall: true, exposed: true },
    { span: 2, tall: true, exposed: false },
    { span: 2, tall: false, exposed: true },
    { span: 4, tall: false, exposed: false },
    { span: 3, tall: false, exposed: true },
    { span: 3, tall: false, exposed: false }
  ]

  return (
    <div aria-hidden className="sheet p-4">
      <div className="flex items-baseline justify-between">
        <span className="label">Contact sheet</span>
        <span className="frame-stamp">06 exp</span>
      </div>

      <div className="mt-3 grid grid-cols-6 gap-2.5">
        {cells.map((cell, i) => (
          <div
            key={i}
            className={cell.exposed ? "frame relative" : "frame-blank relative"}
            style={{
              gridColumn: `span ${cell.span}`,
              height: cell.tall ? 104 : 68,
              animation: `develop-in 700ms ${120 + i * 80}ms backwards`
            }}
          >
            {cell.exposed ? (
              <span className="frame-no absolute left-2 top-1.5">{String(i + 1).padStart(2, "0")}</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
