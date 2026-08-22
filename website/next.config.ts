import type { NextConfig } from "next"

/*
 * Screenshots and favicons are rendered with plain img tags rather than
 * next/image. Favicons come from whichever site the user bookmarked, so the
 * remote host list would have to be the entire web, and the optimiser would
 * spend effort on 16px icons for no gain. No images config is needed here.
 */
const nextConfig: NextConfig = {
  /*
   * Response headers, applied to everything.
   *
   * X-Frame-Options is the one that earns its place: without it the lock
   * screen can be loaded in an invisible iframe over someone else's page and
   * clicked through, which is the whole clickjacking shape. Nothing here is
   * ever meant to be embedded, so DENY costs nothing.
   *
   * The rest are the cheap standards. Referrer-Policy keeps the full url off
   * outbound requests, which matters because bookmark urls are the data.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()"
          }
        ]
      }
    ]
  }
}

export default nextConfig
