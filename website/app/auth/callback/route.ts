import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "~/lib/supabase/server"

/**
 * Landing spot for the email confirmation link. Exchanges the one time code
 * for a session cookie, then sends the user on to the tray.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  const raw = searchParams.get("next") ?? "/app"
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/app"

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
