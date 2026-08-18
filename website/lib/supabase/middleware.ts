import { NextResponse, type NextRequest } from "next/server"

import { createServerClient } from "@supabase/ssr"

import type { Database } from "~/types/db"

import { supabaseAnonKey, supabaseUrl } from "./env"

/** Routes that require a session. Everything else is public. */
const PROTECTED = ["/app"]

/** Routes a signed in user should not sit on. */
const AUTH_ONLY = ["/login"]

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      }
    }
  })

  // Touching getUser() is what refreshes an expiring token.
  const {
    data: { user }
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  if (user && AUTH_ONLY.includes(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/app"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return response
}
