"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"

import { signIn, signUp } from "~/app/lock/actions"

import { GreaseCircle } from "./Wordmark"

type Phase = "closed" | "opening" | "rejected"
type Mode = "in" | "up"

/** Long enough to read as a lid opening, short enough not to be a toll booth. */
const OPEN_MS = 1100

/**
 * The door.
 *
 * A closed bento seen from above: two lids meeting down the middle, the form
 * pencilled on the left one. Getting in scrawls a grease mark, parts the lids,
 * and lets the compartments behind come up before handing off to the sheet.
 *
 * The lids sit on a real compartment grid rather than a picture of one, and the
 * ground colour matches /app exactly. Without that the navigation at the end
 * flashes and the whole effect falls apart.
 */
export function LockScreen({
  next,
  idled,
  inviteRequired
}: {
  next: string
  idled: boolean
  inviteRequired: boolean
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("in")
  const [phase, setPhase] = useState<Phase>("closed")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    emailRef.current?.focus()
  }, [mode])

  /*
   * A plain submit handler rather than <form action={fn}>. React resets an
   * uncontrolled form once its action prop resolves, which is right for a
   * comment box and wrong here: getting the confirm field wrong would wipe the
   * email and password too, and you would retype all three to fix one.
   */
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setError(null)

    startTransition(async () => {
      const result = mode === "in" ? await signIn(formData) : await signUp(formData)

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
  const signingUp = mode === "up"

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

      {opening ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/2 w-40 -translate-x-1/2 bg-gradient-to-r from-transparent via-print/25 to-transparent"
          style={{ animation: `light-spill ${OPEN_MS}ms ease-out forwards` }}
        />
      ) : null}

      <div className="pointer-events-none absolute inset-0 flex">
        <LidHalf side="left" opening={opening}>
          <div className="pointer-events-auto ml-auto w-full max-w-sm px-6 py-8 sm:px-10">
            <p className="label">Bento</p>
            <h1 className="head-2 mt-3">
              {signingUp ? "New roll" : idled ? "Locked itself" : "Closed"}
            </h1>
            <p className="mt-2 max-w-xs text-[11px] leading-relaxed text-silver-dim">
              {signingUp
                ? "Make an account and start your own contact sheet."
                : idled
                  ? "It sat untouched for a while, so it shut. Open it again."
                  : "Everything you saved is behind this."}
            </p>

            <form
              onSubmit={onSubmit}
              className={`mt-6 space-y-3 ${phase === "rejected" ? "animate-reject" : ""}`}
            >
              <div>
                <label htmlFor="lock-email" className="label">
                  Email
                </label>
                <input
                  ref={emailRef}
                  id="lock-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  spellCheck={false}
                  className="field mt-2"
                />
              </div>

              <div>
                <label htmlFor="lock-password" className="label">
                  Password
                </label>
                <input
                  id="lock-password"
                  name="password"
                  type="password"
                  required
                  minLength={signingUp ? 10 : undefined}
                  autoComplete={signingUp ? "new-password" : "current-password"}
                  className="field mt-2"
                />
                {signingUp ? (
                  <p className="mt-1.5 text-[10px] text-silver-dim">At least 10 characters.</p>
                ) : null}
              </div>

              {signingUp ? (
                <div>
                  <label htmlFor="lock-confirm" className="label">
                    Again
                  </label>
                  <input
                    id="lock-confirm"
                    name="confirm"
                    type="password"
                    required
                    autoComplete="new-password"
                    className="field mt-2"
                  />
                </div>
              ) : null}

              {signingUp && inviteRequired ? (
                <div>
                  <label htmlFor="lock-invite" className="label">
                    Invite code
                  </label>
                  <input id="lock-invite" name="invite" required className="field mt-2" />
                </div>
              ) : null}

              <label className="flex cursor-pointer items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  name="remember"
                  className="h-3.5 w-3.5 shrink-0 accent-[var(--color-grease)]"
                />
                <span className="text-[10px] uppercase tracking-[0.14em] text-silver-dim">
                  Stay signed in
                </span>
              </label>

              {error ? (
                <div role="alert" className="notice">
                  {error}
                </div>
              ) : null}

              <button type="submit" disabled={pending || opening} className="shutter w-full">
                {opening ? "Opening" : pending ? "Checking" : signingUp ? "Create account" : "Open"}
              </button>

              <button
                type="button"
                className="ghost w-full pt-1"
                onClick={() => {
                  setMode(signingUp ? "in" : "up")
                  setError(null)
                }}
              >
                {signingUp ? "I already have an account" : "Create an account"}
              </button>
            </form>
          </div>
        </LidHalf>

        <LidHalf side="right" opening={opening}>
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
      className="relative flex w-1/2 items-center justify-center overflow-y-auto bg-darkroom"
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
