import Link from "next/link"

/**
 * The film leader. Matches the extension popup's header exactly: the name in
 * wide tracked Oswald, a roll number beside it, and the frame count off to the
 * right where a camera would show its exposure counter.
 */
export function Wordmark({ href = "/app", size = "md" }: { href?: string; size?: "md" | "lg" }) {
  const name = size === "lg" ? "text-[26px]" : "text-[20px]"

  return (
    <Link href={href} className="group flex items-baseline gap-2.5">
      <span
        className={`${name} font-[family-name:var(--font-head)] font-semibold uppercase leading-none tracking-[0.18em] text-print transition-colors group-hover:text-grease`}
      >
        Bento
      </span>
      <span className="font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[0.16em] text-silver-dim">
        Roll 01
      </span>
    </Link>
  )
}

/** The exposure counter, sitting where a camera would show it. */
export function ExposureCount({ count }: { count: number }) {
  return (
    <span className="font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[0.14em] text-silver">
      {count} exp
    </span>
  )
}

/**
 * The hand drawn grease pencil circle, shared by the tray and the lock screen.
 * Deliberately not a clean ellipse: it wobbles, and it overshoots where the
 * hand came back round. Same path data as the extension popup.
 *
 * When `draw` is set the stroke animates itself on, so starring something
 * looks like the pencil actually being used rather than an icon swapping.
 */
export function GreaseCircle({ marked, draw = false }: { marked: boolean; draw?: boolean }) {
  if (!marked) {
    return (
      <svg viewBox="0 0 30 30" className="h-full w-full" aria-hidden>
        <circle
          cx="15"
          cy="15"
          r="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeDasharray="3 3"
          opacity="0.6"
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 30 30" className="h-full w-full" aria-hidden>
      <path
        className={draw ? "animate-grease" : undefined}
        style={draw ? ({ "--dash": "78" } as React.CSSProperties) : undefined}
        d="M20.8 5.9c4.4 1.6 6.4 6.7 4.6 11.1c-1.9 4.6-7.4 7.3-12.2 6.1C8.2 21.9 5 17.2 5.7 12.4C6.4 7.8 10.8 4.4 15.6 4.6c3.4.1 6.7 1.7 8.5 4.3c.5.8.9 1.6 1.1 2.5"
        fill="none"
        stroke="var(--color-grease)"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />
      <path
        className={draw ? "animate-grease" : undefined}
        style={draw ? ({ "--dash": "34", animationDelay: "160ms" } as React.CSSProperties) : undefined}
        d="M22.4 8.2c2.3 3.1 2 7.9-.8 10.6c-3 2.9-8.3 3.4-11.9 1.1"
        fill="none"
        stroke="var(--color-grease)"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  )
}
