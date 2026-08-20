"use client"

import { useEffect, useRef } from "react"

/**
 * Closes the lid after a stretch of no activity.
 *
 * This is a convenience, not the enforcement. The server refuses a token older
 * than the same window regardless of whether this component ever ran, so the
 * two cannot disagree in a way that matters: the worst case here is that the
 * page still looks unlocked until the next request, which then bounces.
 *
 * Activity is sampled rather than debounced. Storing a timestamp on every
 * mousemove is wasteful, and a single interval checking one number costs
 * nothing, so the loop below wakes up occasionally instead of the events
 * doing work.
 */
export function IdleWatcher({ timeoutMs }: { timeoutMs: number }) {
  const lastActive = useRef(Date.now())

  useEffect(() => {
    function touch() {
      lastActive.current = Date.now()
    }

    const events = ["pointerdown", "keydown", "wheel", "touchstart", "focus"] as const
    for (const event of events) window.addEventListener(event, touch, { passive: true })

    // Coming back to a tab that was hidden for an hour should lock immediately
    // rather than waiting for the next tick.
    function onVisible() {
      if (document.visibilityState !== "visible") return
      if (Date.now() - lastActive.current >= timeoutMs) window.location.href = "/lock?why=idle"
      else touch()
    }
    document.addEventListener("visibilitychange", onVisible)

    const tick = setInterval(() => {
      if (Date.now() - lastActive.current >= timeoutMs) window.location.href = "/lock?why=idle"
    }, 15_000)

    return () => {
      for (const event of events) window.removeEventListener(event, touch)
      document.removeEventListener("visibilitychange", onVisible)
      clearInterval(tick)
    }
  }, [timeoutMs])

  return null
}
