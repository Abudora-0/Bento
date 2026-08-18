import type { NextConfig } from "next"

/*
 * Screenshots and favicons are rendered with plain img tags rather than
 * next/image. Favicons come from whichever site the user bookmarked, so the
 * remote host list would have to be the entire web, and the optimiser would
 * spend effort on 16px icons for no gain. No images config is needed here.
 */
const nextConfig: NextConfig = {}

export default nextConfig
