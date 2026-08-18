import type { Metadata } from "next"

import { AuthForm } from "~/components/AuthForm"
import { Wordmark } from "~/components/Wordmark"

export const metadata: Metadata = { title: "Sign in" }

type SearchParams = Promise<{ mode?: string; next?: string }>

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const mode = params.mode === "signup" ? "signup" : "signin"

  // Only allow same origin destinations, never an absolute URL from the query.
  const raw = params.next ?? "/app"
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/app"

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-16">
      <div className="tray p-7 sm:p-9">
        <div className="relative">
          <Wordmark href="/" size="lg" />

          <h1 className="mt-8 font-[family-name:var(--font-display)] text-2xl text-rice">
            {mode === "signup" ? "Set out a new tray" : "Open your tray"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-rice/55">
            The same account signs you into the browser extension, so anything you capture there
            lands here.
          </p>

          <AuthForm initialMode={mode} next={next} />
        </div>
      </div>
    </main>
  )
}
