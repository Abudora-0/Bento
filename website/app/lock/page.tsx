import type { Metadata } from "next"

import { LockScreen } from "~/components/LockScreen"

import { inviteRequired } from "./actions"

export const metadata: Metadata = { title: "Locked" }
export const dynamic = "force-dynamic"

type SearchParams = Promise<{ next?: string; why?: string; new?: string }>

export default async function LockPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams

  // Middleware only ever writes a same origin path here, but this page can be
  // reached with anything in the query string, so it gets checked again rather
  // than trusted. An absolute url would turn the lock into an open redirect.
  const raw = params.next ?? "/app"
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/app"

  return (
    <LockScreen
      next={next}
      idled={params.why === "idle"}
      inviteRequired={await inviteRequired()}
      /* The landing page's Create an account button lands straight on signup
         rather than on sign in with a switch to find. */
      startOnSignUp={params.new === "1"}
    />
  )
}
