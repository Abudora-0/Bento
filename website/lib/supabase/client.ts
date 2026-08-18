"use client"

import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "~/types/db"

import { supabaseAnonKey, supabaseUrl } from "./env"

/** Supabase client for client components. Safe to call repeatedly, it memoises. */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey())
}
