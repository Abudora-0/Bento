"use server"

import { revalidatePath } from "next/cache"

import { requireUser } from "~/lib/current-user"
import { regenerateApiToken } from "~/lib/db/users"

export type TokenResult = { ok: true; token: string } | { ok: false; error: string }

/**
 * Issues a new extension token and invalidates the old one.
 *
 * This is the only way to cut off a token that leaked, since there is no
 * password to change that would do it. Any extension still holding the old one
 * starts failing immediately, which is the point.
 */
export async function regenerateToken(): Promise<TokenResult> {
  try {
    const user = await requireUser()
    const token = await regenerateApiToken(user.id)

    if (!token) return { ok: false, error: "Could not issue a new token." }

    revalidatePath("/settings")
    return { ok: true, token }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." }
  }
}
