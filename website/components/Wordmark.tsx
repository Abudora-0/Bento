import Link from "next/link"

/** The tray mark plus the name, used in the header and on the landing page. */
export function Wordmark({ href = "/", size = "md" }: { href?: string; size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-11 w-11" : "h-8 w-8"
  const type = size === "lg" ? "text-3xl" : "text-xl"

  return (
    <Link href={href} className="group inline-flex items-center gap-3">
      <span
        aria-hidden
        className={`${box} shrink-0 rounded-[9px] bg-oxblood-deep p-[5px] shadow-[inset_0_0_0_1px_rgba(201,162,74,0.6)]`}
      >
        <svg viewBox="0 0 40 40" className="h-full w-full">
          <rect x="1" y="1" width="17" height="21" rx="2.5" fill="#f3e9d6" />
          <rect x="21" y="1" width="18" height="9" rx="2.5" fill="#6d7f4a" />
          <rect x="21" y="13" width="18" height="9" rx="2.5" fill="#f3e9d6" />
          <rect x="1" y="25" width="11" height="14" rx="2.5" fill="#6d7f4a" />
          <rect x="15" y="25" width="24" height="14" rx="2.5" fill="#f3e9d6" />
        </svg>
      </span>
      <span
        className={`${type} font-[family-name:var(--font-display)] font-semibold tracking-[0.06em] text-rice transition-colors group-hover:text-gold-soft`}
      >
        Bento
      </span>
    </Link>
  )
}
