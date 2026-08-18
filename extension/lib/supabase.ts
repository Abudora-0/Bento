import { createClient, type SupportedStorage } from "@supabase/supabase-js"

import type { Database } from "./types"

const SUPABASE_URL = process.env.PLASMO_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing PLASMO_PUBLIC_SUPABASE_URL or PLASMO_PUBLIC_SUPABASE_ANON_KEY. Copy extension/.env.example to extension/.env.local and fill it in."
  )
}

/**
 * The session has to live in chrome.storage.local, not localStorage. The popup
 * is torn down every time it closes and the service worker is torn down after
 * a few seconds idle, so both contexts need the same durable store.
 */
const chromeStorage: SupportedStorage = {
  async getItem(key) {
    const result = await chrome.storage.local.get(key)
    return (result[key] as string | undefined) ?? null
  },
  async setItem(key, value) {
    await chrome.storage.local.set({ [key]: value })
  },
  async removeItem(key) {
    await chrome.storage.local.remove(key)
  }
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: chromeStorage,
    persistSession: true,
    autoRefreshToken: true,
    // There is no redirect flow inside a popup, so nothing to detect.
    detectSessionInUrl: false,
    flowType: "pkce"
  }
})
