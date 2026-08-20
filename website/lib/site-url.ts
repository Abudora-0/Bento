/** Origin used to build absolute urls, screenshots in particular. */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, "")

  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL ?? process.env.VERCEL_URL
  if (vercel) return `https://${vercel}`

  return "http://localhost:3000"
}
