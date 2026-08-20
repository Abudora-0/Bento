import type { Metadata } from "next"

import { LockScreen } from "~/components/LockScreen"

export const metadata: Metadata = { title: "Locked" }
export const dynamic = "force-dynamic"

type SearchParams = Promise<{ next?: string; why?: string }>

export default async function LockPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams

  // Middleware only ever writes a same origin path here, but this page can be
  // reached with anything in the query string, so it gets checked again rather
  // than trusted. An absolute url would turn the lock into an open redirect.
  const raw = params.next ?? "/app"
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/app"

  return <LockScreen next={next} idled={params.why === "idle"} />
}
