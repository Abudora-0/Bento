"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"

import { unlock } from "~/app/lock/actions"

import { GreaseCircle } from "./Wordmark"

type Phase = "closed" | "opening" | "rejected"

/** Long enough to read as a lid opening, short enough not to be a toll booth. */
const OPEN_MS = 1100

/**
 * The door.
 *
 * A closed bento seen from above: two lacquer lids meeting down the middle,
 * the credentials pencilled on the left one. Getting it right scrawls a grease
 * mark, parts the lids, and lets the compartments behind come up before handing
 * off to the real sheet.
 *
 * The lids sit on top of a real compartment grid rather than a picture of one,
 * so what is revealed underneath is the same geometry the tray uses, and the
 * ground colour matches /app exactly. Without that the navigation at the end
 * flashes and the whole effect falls apart.
 */
export function LockScreen({ next, idled }: { next: string; idled: boolean }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("closed")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const userRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    userRef.current?.focus()
  }, [])

  function onSubmit(formData: FormData) {
    setError(null)

    startTransition(async () => {
      const result = await unlock(formData)

      if (!result.ok) {
        setError(result.error)
        setPhase("rejected")
        // Let the shake finish, then settle back so it can be retried.
        setTimeout(() => setPhase("closed"), 500)
        return
      }

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      if (reduced) {
        router.replace(next)
        router.refresh()
        return
      }

      setPhase("opening")
      setTimeout(() => {
        router.replace(next)
        router.refresh()
      }, OPEN_MS)
    })
  }

  const opening = phase === "opening"

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-gutter px-4">
      {/* What is behind the lid: the compartment geometry, waiting. */}
      <div
        aria-hidden
        className={`absolute inset-0 grid grid-cols-6 gap-3 p-8 transition-opacity duration-700 ${
          opening ? "opacity-100" : "opacity-0"
        }`}
      >
        {Array.from({ length: 18 }, (_, i) => (
          <div
            key={i}
            className="frame-blank"
            style={{
              gridColumn: `span ${[3, 3, 2, 2, 2, 4][i % 6]}`,
              height: i % 3 === 0 ? 132 : 96,
              animation: opening ? `develop-in 620ms ${i * 28}ms backwards` : undefined
            }}
          />
        ))}
      </div>

      {/* The light that spills out of the gap as the lids part. */}
      {opening ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/2 w-40 -translate-x-1/2 bg-gradient-to-r from-transparent via-print/25 to-transparent"
          style={{ animation: `light-spill ${OPEN_MS}ms ease-out forwards` }}
        />
      ) : null}

      {/* The two lids. */}
      <div className="pointer-events-none absolute inset-0 flex">
        <LidHalf side="left" opening={opening}>
          <div className="pointer-events-auto ml-auto w-full max-w-sm px-6 sm:px-10">
            <p className="label">Bento</p>
            <h1 className="head-2 mt-3">{idled ? "Locked itself" : "Closed"}</h1>
            <p className="mt-2 max-w-xs text-[11px] leading-relaxed text-silver-dim">
              {idled
                ? "It sat untouched for a while, so it shut. Open it again."
                : "Everything you saved is behind this. Two things open it."}
            </p>

            <form
              action={onSubmit}
              className={`mt-7 space-y-3 ${phase === "rejected" ? "animate-reject" : ""}`}
            >
              <div>
                <label htmlFor="lock-user" className="label">
                  Name
                </label>
                <input
                  ref={userRef}
                  id="lock-user"
                  name="user"
                  required
                  autoComplete="username"
                  spellCheck={false}
                  className="field mt-2"
                />
              </div>

              <div>
                <label htmlFor="lock-pass" className="label">
                  Secret
                </label>
                <input
                  id="lock-pass"
                  name="pass"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="field mt-2"
                />
              </div>

              {error ? (
                <div role="alert" className="notice">
                  {error}
                </div>
              ) : null}

              <button type="submit" disabled={pending || opening} className="shutter w-full">
                {opening ? "Opening" : pending ? "Checking" : "Open"}
              </button>
            </form>
          </div>
        </LidHalf>

        <LidHalf side="right" opening={opening}>
          {/* The mark the pencil leaves when it lets you in. */}
          <div
            className={`h-24 w-24 transition-opacity duration-200 ${opening ? "opacity-100" : "opacity-0"}`}
          >
            <GreaseCircle marked draw={opening} />
          </div>
        </LidHalf>
      </div>
    </main>
  )
}

function LidHalf({
  side,
  opening,
  children
}: {
  side: "left" | "right"
  opening: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className="relative flex w-1/2 items-center justify-center bg-darkroom"
      style={{
        // The two halves are mirror images, so one keyframe drives both and
        // the sign of --dir decides which way each one swings.
        ["--dir" as string]: side === "left" ? -1 : 1,
        boxShadow:
          side === "left"
            ? "inset -1px 0 0 var(--line-live), inset 0 0 0 1px var(--line-frame)"
            : "inset 1px 0 0 var(--line-live), inset 0 0 0 1px var(--line-frame)",
        animation: opening ? `lid-part ${OPEN_MS}ms cubic-bezier(0.7, 0, 0.3, 1) forwards` : undefined
      }}
    >
      {children}
    </div>
  )
}
