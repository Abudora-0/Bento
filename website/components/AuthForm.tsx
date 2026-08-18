"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { createClient } from "~/lib/supabase/client"

type Mode = "signin" | "signup"

export function AuthForm({ initialMode, next }: { initialMode: Mode; next: string }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    setNotice(null)

    const supabase = createClient()

    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` }
      })

      if (signUpError) {
        setError(signUpError.message)
        setPending(false)
        return
      }

      // With email confirmation switched on there is no session yet.
      if (!data.session) {
        setNotice("Check your inbox, we sent a link to confirm the address.")
        setPending(false)
        return
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        setError(signInError.message)
        setPending(false)
        return
      }
    }

    router.replace(next)
    router.refresh()
  }

  const isSignup = mode === "signup"

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <div>
        <label htmlFor="email" className="label-mono text-gold">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="field mt-2 font-[family-name:var(--font-mono)] text-sm"
        />
      </div>

      <div>
        <label htmlFor="password" className="label-mono text-gold">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={isSignup ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isSignup ? "at least 8 characters" : ""}
          className="field mt-2 font-[family-name:var(--font-mono)] text-sm"
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-oxblood/30 px-3 py-2 text-sm text-rice shadow-[inset_0_0_0_1px_rgba(201,162,74,0.35)]"
        >
          {error}
        </p>
      ) : null}

      {notice ? (
        <p
          role="status"
          className="rounded-lg bg-matcha/20 px-3 py-2 text-sm text-rice shadow-[inset_0_0_0_1px_rgba(142,163,100,0.4)]"
        >
          {notice}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn-seal w-full">
        {pending ? "One moment" : isSignup ? "Create account" : "Sign in"}
      </button>

      <div className="seam mt-6!" />

      <p className="text-center text-sm text-rice/55">
        {isSignup ? "Already have a tray?" : "No account yet?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(isSignup ? "signin" : "signup")
            setError(null)
            setNotice(null)
          }}
          className="text-gold underline-offset-4 hover:underline"
        >
          {isSignup ? "Sign in" : "Create one"}
        </button>
      </p>

      <p className="text-center">
        <Link href="/" className="label-mono text-rice/35 hover:text-rice/60">
          Back
        </Link>
      </p>
    </form>
  )
}
