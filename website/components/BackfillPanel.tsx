"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { backfillShareImages } from "~/app/(dashboard)/actions"
import type { ImageCursor } from "~/lib/db/bookmarks"

/**
 * Finds pictures for bookmarks that arrived without one.
 *
 * An imported bookmark is a url and nothing else, so its frame shows unexposed
 * stock. This walks them and asks each site for its share image, which is the
 * only picture reachable from a server: a real screenshot needs your browser
 * and your session, which is the extension's job, not this one.
 *
 * The loop lives here rather than on the server because each batch is a round
 * of outbound requests, and a couple of hundred of those in one invocation
 * would run well past any sensible function timeout.
 */
export function BackfillPanel({ missing }: { missing: number }) {
  const router = useRouter()
  const [state, setState] = useState<
    { at: "idle" } | { at: "running"; looked: number; found: number } | { at: "stopped"; looked: number; found: number }
  >({ at: "idle" })
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setError(null)

    let looked = 0
    let found = 0
    let cursor: ImageCursor | null = null
    setState({ at: "running", looked, found })

    for (;;) {
      const result: Awaited<ReturnType<typeof backfillShareImages>> = await backfillShareImages(cursor)

      if (!result.ok) {
        setError(result.error)
        setState({ at: "stopped", looked, found })
        return
      }

      // Nothing left after the cursor, so there is nothing more this can do.
      if (result.looked === 0 || !result.nextCursor) break

      looked += result.looked
      found += result.found
      cursor = result.nextCursor
      setState({ at: "running", looked, found })

      // A stop, in case a batch ever comes back without advancing.
      if (looked > 5000) break
    }

    setState({ at: "stopped", looked, found })
    router.refresh()
  }

  if (missing === 0 && state.at === "idle") return null

  return (
    <div className="frame">
      <div className="relative flex items-center justify-between gap-2">
        <span className="frame-no">04</span>
        <span className="frame-stamp tabular-nums">{missing} unexposed</span>
      </div>

      <h3 className="head-3 mt-3">Find pictures for the rest</h3>

      <p className="mt-2 text-[11px] leading-relaxed text-silver-dim">
        Imported bookmarks arrive as an address and nothing else. This asks each site for the image
        it offers when somebody shares it, which is not the same as a screenshot of the page you
        saw, but it fills the sheet. Anything behind a sign in will have none, and a real capture
        from the extension always wins over this.
      </p>

      {state.at === "idle" ? (
        <button type="button" className="shutter mt-4" onClick={run}>
          Look them up
        </button>
      ) : null}

      {state.at === "running" ? (
        <div className="mt-4">
          <p className="text-[11px] text-silver tabular-nums">
            Looked at {state.looked}, found {state.found}
          </p>
          <p className="mt-1 text-[10.5px] text-silver-dim">
            Leave this open. It goes a few at a time so nothing times out.
          </p>
        </div>
      ) : null}

      {state.at === "stopped" ? (
        <div className="mt-4">
          <p className="text-[11px] text-silver tabular-nums">
            Looked at {state.looked}, found {state.found}.
          </p>
          <p className="mt-1 text-[10.5px] leading-relaxed text-silver-dim">
            The ones with nothing had no share image to give. They keep their unexposed frame until
            you capture them with the extension.
          </p>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="notice mt-3">
          {error}
        </div>
      ) : null}
    </div>
  )
}
