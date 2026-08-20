"use client"

import { useTransition } from "react"

import { lockNow } from "~/app/lock/actions"

/** Closes the lid by hand, for walking away from a shared machine. */
export function LockButton() {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void lockNow())}
      className="ghost-btn"
      title="Lock Bento"
    >
      {pending ? "Closing" : "Lock"}
    </button>
  )
}
