import type { Metadata, Viewport } from "next"

/*
 * Latin only entrypoints, self hosted from Fontsource rather than fetched by
 * next/font/google. The same two faces the extension popup uses, which is the
 * point: one product, one type system.
 */
import "@fontsource/oswald/latin-400.css"
import "@fontsource/oswald/latin-500.css"
import "@fontsource/oswald/latin-600.css"
import "@fontsource/ibm-plex-mono/latin-400.css"
import "@fontsource/ibm-plex-mono/latin-500.css"

import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "Bento",
    template: "%s / Bento"
  },
  description:
    "A contact sheet for everything you save. Capture a tab from the browser extension, then browse, search and file it here.",
  applicationName: "Bento",
  icons: { icon: "/icon.svg" }
}

export const viewport: Viewport = {
  themeColor: "#050506"
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  )
}
