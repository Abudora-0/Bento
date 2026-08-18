import { cookies } from "next/headers"

import { createServerClient } from "@supabase/ssr"

import type { Database } from "~/types/db"

import { supabaseAnonKey, supabaseUrl } from "./env"

/**
 * Supabase client for server components, route handlers and server actions.
 * The cookie writes are wrapped because server components are not allowed to
 * set cookies, refresh there is handled by the middleware instead.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called from a server component. The middleware refreshes the
          // session, so there is nothing to do here.
        }
      }
    }
  })
}
