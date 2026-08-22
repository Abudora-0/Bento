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
  // One reveal state for the whole form, see the confirm field below.
  const [shown, setShown] = useState(false)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstFieldRef.current?.focus()
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
          <div className="pointer-events-auto mx-auto w-full max-w-sm px-6 py-8 sm:px-10 md:ml-auto md:mr-0 md:pr-16">
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

            <div className="section-rule mt-6">
              <span>{signingUp ? "Load a roll" : "The door"}</span>
            </div>

            <form
              onSubmit={onSubmit}
              className={`mt-5 space-y-3 ${phase === "rejected" ? "animate-reject" : ""}`}
            >
              {signingUp ? (
                <>
                  <div>
                    <label htmlFor="lock-username" className="label">
                      Username
                    </label>
                    <input
                      ref={firstFieldRef}
                      id="lock-username"
                      name="username"
                      required
                      minLength={3}
                      maxLength={24}
                      pattern="[a-zA-Z0-9][a-zA-Z0-9_.\-]*"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      className="field mt-2"
                    />
                    <p className="mt-1.5 text-[10px] text-silver-dim">
                      3 to 24 characters. Letters, numbers, and . _ - only.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="lock-email" className="label">
                      Email
                    </label>
                    <input
                      id="lock-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      className="field mt-2"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label htmlFor="lock-identifier" className="label">
                    Email or username
                  </label>
                  <input
                    ref={firstFieldRef}
                    id="lock-identifier"
                    name="identifier"
                    required
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="field mt-2"
                  />
                </div>
              )}

              <div>
                <label htmlFor="lock-password" className="label">
                  Password
                </label>
                <RevealField
                  id="lock-password"
                  name="password"
                  required
                  minLength={signingUp ? 10 : undefined}
                  autoComplete={signingUp ? "new-password" : "current-password"}
                  shown={shown}
                  onToggle={() => setShown((was) => !was)}
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
                  {/* No separate toggle. One control governs both, so they can
                      never end up in different states and have you comparing a
                      visible password against a row of dots. */}
                  <RevealField
                    id="lock-confirm"
                    name="confirm"
                    required
                    autoComplete="new-password"
                    shown={shown}
                    onToggle={() => setShown((was) => !was)}
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
                <input type="checkbox" name="remember" className="check" />
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

              <div className="segmented" role="group" aria-label="Sign in or create an account">
                {(["in", "up"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={mode === option}
                    onClick={() => {
                      if (mode === option) return
                      setMode(option)
                      setError(null)
                      // Never carry a revealed password across the switch. The
                      // fields are being replaced anyway, and leaving it on
                      // would start the next form with its password in clear.
                      setShown(false)
                    }}
                  >
                    {option === "in" ? "Sign in" : "New account"}
                  </button>
                ))}
              </div>
            </form>
          </div>
        </LidHalf>

        <LidHalf side="right" opening={opening}>
          <PrintedLid opening={opening} />
        </LidHalf>
      </div>
    </main>
  )
}

/**
 * A password field with a reveal toggle.
 *
 * The toggle is a real button, so it is reachable by keyboard and announces
 * its state, and it is type="button" so pressing it never submits the form.
 * It flips the input's type rather than rendering the value anywhere, which
 * keeps the browser's own password handling intact.
 */
function RevealField({
  id,
  name,
  required,
  minLength,
  autoComplete,
  shown,
  onToggle
}: {
  id: string
  name: string
  required?: boolean
  minLength?: number
  autoComplete: string
  shown: boolean
  onToggle: () => void
}) {
  return (
    <div className="field-shell mt-2">
      <input
        id={id}
        name={name}
        type={shown ? "text" : "password"}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        className="field field-with-action"
      />
      <button
        type="button"
        className="field-action"
        onClick={onToggle}
        aria-pressed={shown}
        aria-controls={id}
        title={shown ? "Hide the password" : "Show the password"}
      >
        {shown ? "Hide" : "Show"}
      </button>
    </div>
  )
}

/**
 * What is printed on the right lid: a contact sheet.
 *
 * The half used to be empty until the opening animation ran, which on a wide
 * screen meant half the page was doing nothing at all and the whole thing read
 * as unfinished rather than as a closed box. Putting the sheet here also makes
 * the metaphor work in the right order: this is the thing the lid is hiding,
 * printed on its underside, and it is already coming through before the lid
 * parts.
 *
 * Entirely decorative, so it is hidden from assistive technology. The numbers
 * are fixed rather than random, because a value that differs between the
 * server render and the client one is a hydration mismatch.
 */
function PrintedLid({ opening }: { opening: boolean }) {
  const cells = [
    { span: 3, tall: true, exposed: true, marked: true },
    { span: 3, tall: true, exposed: false, marked: false },
    { span: 2, tall: false, exposed: true, marked: false },
    { span: 4, tall: false, exposed: false, marked: false },
    { span: 2, tall: false, exposed: false, marked: false },
    { span: 4, tall: true, exposed: true, marked: false },
    { span: 3, tall: false, exposed: false, marked: false },
    { span: 3, tall: false, exposed: true, marked: false }
  ]

  return (
    <div
      aria-hidden
      className={`w-full max-w-md px-8 py-10 transition-opacity duration-500 ${
        opening ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className="label">Contact sheet</span>
        <span className="frame-stamp">Roll 01</span>
      </div>

      <div className="mt-3 grid grid-cols-6 gap-2">
        {cells.map((cell, i) => (
          <div
            key={i}
            className={cell.exposed ? "frame relative" : "frame-blank relative"}
            style={{
              gridColumn: `span ${cell.span}`,
              height: cell.tall ? 84 : 52,
              animation: `develop-in 700ms ${240 + i * 70}ms backwards`
            }}
          >
            {cell.exposed ? (
              <span className="frame-no absolute left-1.5 top-1">{String(i + 1).padStart(2, "0")}</span>
            ) : null}

            {cell.marked ? (
              <span className="absolute bottom-1 right-1 h-7 w-7">
                <GreaseCircle marked draw />
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <span className="frame-stamp">08 exp</span>
        <span className="frame-stamp">Locked</span>
      </div>
    </div>
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
      className={`relative flex items-center justify-center overflow-y-auto bg-darkroom ${
        side === "left" ? "w-full md:w-1/2" : "hidden md:flex md:w-1/2"
      }`}
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
