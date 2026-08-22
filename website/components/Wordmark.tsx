import Link from "next/link"

/**
 * The mark: logo D, the bento grid.
 *
 * Three compartments with a real size hierarchy, the largest circled in grease
 * pencil. It is the product in miniature, a bento tray and a contact sheet at
 * once, which is the whole conceit of the app in one square.
 *
 * Three and not four: four near equal cells in alternating colours read as a
 * checkerboard rather than as compartments, and they turned to mush at tab
 * size. This was drawn, rasterised and looked at before it was kept.
 *
 * The circle is the same gesture as starring a bookmark, so the identity and
 * the app's one interactive flourish are literally the same drawing.
 */
export function Mark({ className = "", animate = false }: { className?: string; animate?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden focusable="false">
      {/* Compartments. data-cell drives the hover advance, see globals.css. */}
      <g className="mark-cells">
        <rect data-cell="0" x="8" y="8" width="27" height="48" fill="var(--color-print)" />
        <rect data-cell="1" x="39" y="8" width="17" height="19" fill="var(--color-silver-dim)" />
        <rect data-cell="2" x="39" y="31" width="17" height="25" fill="var(--color-print)" />
      </g>

      {/*
       * The grease circle, the same hand drawn path the star uses, sized to sit
       * inside the tall compartment rather than burst out of it. Not a clean
       * ellipse on purpose: it wobbles, and it overshoots where the hand came
       * back round.
       */}
      <g transform="translate(21.5,32) scale(1.18) translate(-15,-15)">
        <path
          className={animate ? "animate-grease" : undefined}
          style={animate ? ({ "--dash": "78" } as React.CSSProperties) : undefined}
          d="M20.8 5.9c4.4 1.6 6.4 6.7 4.6 11.1c-1.9 4.6-7.4 7.3-12.2 6.1C8.2 21.9 5 17.2 5.7 12.4C6.4 7.8 10.8 4.4 15.6 4.6c3.4.1 6.7 1.7 8.5 4.3c.5.8.9 1.6 1.1 2.5"
          fill="none"
          stroke="var(--color-grease)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}

/*
 * The letters, drawn rather than set.
 *
 * A logo is artwork, so it carries no font dependency, renders identically
 * wherever it lands, and lets the extension embed the exact same paths without
 * shipping a font file into an MV3 bundle. It also means the type rule stays
 * intact: live text is still Oswald and IBM Plex Mono everywhere else, and
 * there is no third face in the project.
 *
 * Proportions follow Oswald, condensed and heavy, then cut: a slot through
 * every letter at the same height, echoing the sprocket perforations that run
 * down the edge of a frame. Each letter is one path so they can be staggered.
 */
const LETTERS: string[] = [
  // B
  "M0 0h11.4c4.2 0 6.6 2.1 6.6 5.9c0 2.5-1.1 4.2-3.2 5.1c2.6.8 4 2.7 4 5.6c0 4.2-2.6 6.4-7.2 6.4H0V0zm5.6 4.3v4.6h4.5c1.6 0 2.5-.8 2.5-2.3c0-1.5-.9-2.3-2.5-2.3H5.6zm0 8.8v5.4h5c1.8 0 2.8-.9 2.8-2.7c0-1.8-1-2.7-2.8-2.7h-5z",
  // E
  "M0 0h16.6v4.5H5.6v4.3h9.9v4.4H5.6v5.3h11.3V23H0V0z",
  // N
  "M0 0h5.3l8.1 13.1V0h5.5v23h-5.3L5.5 9.9V23H0V0z",
  // T
  "M0 0h18.6v4.6h-6.5V23H6.5V4.6H0V0z",
  // O
  "M9.9 0C16 0 20 4.6 20 11.5C20 18.4 16 23 9.9 23C3.9 23 0 18.4 0 11.5C0 4.6 3.9 0 9.9 0zm0 4.7c-2.6 0-4.2 2.5-4.2 6.8c0 4.3 1.6 6.8 4.2 6.8c2.7 0 4.3-2.5 4.3-6.8c0-4.3-1.6-6.8-4.3-6.8z"
]

/** Where each letter starts, so tracking is explicit rather than emergent. */
const OFFSETS = [0, 25, 49, 75, 97]
const WORD_WIDTH = 118

/**
 * "BENTO", as outlines.
 *
 * The accessible name comes from the link that wraps it, so this carries no
 * text of its own and is hidden from assistive technology.
 */
function Letters({ animate }: { animate: boolean }) {
  return (
    <svg
      viewBox={`0 0 ${WORD_WIDTH} 23`}
      className="wordmark-letters"
      aria-hidden
      focusable="false"
      role="presentation"
    >
      {LETTERS.map((d, i) => (
        <g key={i} transform={`translate(${OFFSETS[i]},0)`}>
          <path d={d} fill="currentColor" style={animate ? { animationDelay: `${i * 55}ms` } : undefined} />
          {/* The cut. Painted in the page ground, so it reads as a slot rather
              than a line drawn on top. */}
          <rect x="-1" y="10.2" width="23" height="1.6" fill="var(--color-gutter)" />
        </g>
      ))}
    </svg>
  )
}

/**
 * The film leader: the mark, the name, and a roll number beside it.
 *
 * On first paint the letters develop in one at a time, the way a print comes
 * up in the tray, and the grease circle draws itself. Hovering advances the
 * compartments one rung up the alpha ladder in sequence, left to right, like a
 * sheet being wound on. All of it sits behind the reduced motion block.
 */
export function Wordmark({ href = "/app", size = "md" }: { href?: string; size?: "md" | "lg" }) {
  const markSize = size === "lg" ? "h-9 w-9" : "h-7 w-7"
  const wordSize = size === "lg" ? "h-[22px]" : "h-[17px]"

  return (
    <Link href={href} aria-label="Bento" className="wordmark group flex items-center gap-2.5">
      <Mark className={`${markSize} shrink-0`} animate />
      <span className="flex items-baseline gap-2.5">
        <span className={`${wordSize} block text-print`}>
          <Letters animate />
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[0.16em] text-silver-dim tabular-nums">
          Roll 01
        </span>
      </span>
    </Link>
  )
}

/** The exposure counter, sitting where a camera would show it. */
export function ExposureCount({ count }: { count: number }) {
  return (
    <span className="font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[0.14em] text-silver tabular-nums">
      {count} exp
    </span>
  )
}

/**
 * The hand drawn grease pencil circle, shared by the tray, the lock screen and
 * the mark above. Deliberately not a clean ellipse: it wobbles, and it
 * overshoots where the hand came back round. Same path data as the extension.
 *
 * When `draw` is set the stroke animates itself on, so starring something looks
 * like the pencil actually being used rather than an icon swapping.
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
