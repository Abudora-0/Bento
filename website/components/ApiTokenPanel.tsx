"use client"

import { useState, useTransition } from "react"

import { regenerateToken } from "~/app/(dashboard)/settings/actions"

/**
 * The token the extension uses.
 *
 * Shown rather than hidden, because it is not a password: it is copied into
 * the extension by hand, it identifies one person, and it can be replaced in
 * one click if it ever escapes.
 */
export function ApiTokenPanel({ initialToken }: { initialToken: string }) {
  const [token, setToken] = useState(initialToken)
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  async function copy() {
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setError("Could not reach the clipboard. Select the token and copy it by hand.")
    }
  }

  function regenerate() {
    setError(null)
    startTransition(async () => {
      const result = await regenerateToken()
      if (result.ok) {
        setToken(result.token)
        setConfirming(false)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="frame">
      <div className="relative flex items-center justify-between gap-2">
        <span className="frame-no">02</span>
        <span className="frame-stamp">extension</span>
      </div>

      <h2 className="head-2 mt-3">Your capture token</h2>

      <p className="mt-2 max-w-md text-[11px] leading-relaxed text-silver-dim">
        Paste this into the extension popup along with this site&apos;s address. It stands in for your
        password there, so treat it the same way.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {/*
          Wraps rather than scrolling. A 48 character token in a narrow column
          used to overflow its box and get clipped, so on a phone you could
          copy it but never actually read it. Two lines of mono is fine, and
          break-all is needed because a hex string has nowhere to break.
        */}
        <code className="min-w-0 flex-1 break-all bg-gutter px-3 py-2 font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-print shadow-[inset_0_0_0_1px_var(--line-field)]">
          {token}
        </code>

        <button type="button" onClick={copy} className="ghost-btn shrink-0">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {error ? (
        <div role="alert" className="notice mt-3">
          {error}
        </div>
      ) : null}

      <div className="section-rule my-5">
        <span>If it leaks</span>
      </div>

      <p className="max-w-md text-[11px] leading-relaxed text-silver-dim">
        Issuing a new one immediately stops the old token working. Any extension still holding it will
        need this one pasted in again.
      </p>

      <div className="mt-4 flex items-center gap-2">
        {confirming ? (
          <>
            <button type="button" onClick={() => setConfirming(false)} className="ghost-btn">
              Keep it
            </button>
            <button type="button" disabled={pending} onClick={regenerate} className="shutter text-[11px]">
              {pending ? "Issuing" : "Yes, replace it"}
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="ghost-btn">
            Issue a new token
          </button>
        )}
      </div>
    </div>
  )
}
