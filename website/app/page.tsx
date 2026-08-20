import { redirect } from "next/navigation"

/**
 * There is one user and one tray, and middleware.ts already gates every route
 * behind the shared secret, so a separate marketing landing page with its own
 * sign in and sign up calls to action has nothing left to sell. Straight to
 * the tray.
 */
export default function Index() {
  redirect("/app")
}
