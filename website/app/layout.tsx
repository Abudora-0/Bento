import type { Metadata, Viewport } from "next"

/*
 * Fonts are self hosted from Fontsource rather than fetched by next/font/google.
 *
 * Shippori Mincho and Zen Kaku Gothic New are Japanese faces, and Google splits
 * them into numbered unicode range subsets that `subsets: ["latin"]` does not
 * filter. A clean build was pulling well over seven hundred woff2 files, which
 * is slow at best and hangs the build worker at worst. These latin only
 * entrypoints ship in node_modules, so the build touches the network zero times
 * and the fonts are served from our own origin.
 */
import "@fontsource/shippori-mincho/latin-400.css"
import "@fontsource/shippori-mincho/latin-500.css"
import "@fontsource/shippori-mincho/latin-600.css"
import "@fontsource/zen-kaku-gothic-new/latin-400.css"
import "@fontsource/zen-kaku-gothic-new/latin-500.css"
import "@fontsource/zen-kaku-gothic-new/latin-700.css"
import "@fontsource/space-mono/latin-400.css"

import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "Bento",
    template: "%s / Bento"
  },
  description:
    "A lacquered tray for everything you save. Capture a tab from the browser extension, then browse, search and arrange it here.",
  applicationName: "Bento",
  icons: { icon: "/icon.svg" }
}

export const viewport: Viewport = {
  themeColor: "#060404"
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  )
}
