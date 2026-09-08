/**
 * The picture that fills a frame.
 *
 * A frame is the photograph, so the capture is the frame's ground rather than
 * a plate stacked above the caption. Everything else in the frame sits on top
 * of this, which is what lets a 112px compartment carry a picture at all.
 *
 * Shared by the sheet, the landing page hero and the lock screen, so all three
 * read as the same object rather than as three things that resemble each
 * other. No hooks, so it renders on the server as happily as in the two client
 * components that use it.
 *
 * Order inside a frame is load bearing:
 *   z-0   this, and the two scrims
 *   z-1   the sprocket rails, which are pseudo elements on .frame
 *   z-10  the full frame anchor in BookmarkCell
 *   z-20  every control that has to stay clickable through that anchor
 */
export function FrameShot({
  src,
  faviconUrl = null,
  host = "",
  scrim = "both",
  tone = "held"
}: {
  /** The capture, or null for a frame nothing has been exposed onto yet. */
  src: string | null
  /** Stands in for a missing capture, held back like a watermark. */
  faviconUrl?: string | null
  /** Last resort behind the favicon: the host's first letter. */
  host?: string
  /** Which scrims to lay over it. Frames with no text want none. */
  scrim?: "both" | "bottom" | "none"
  /**
   * How far forward the picture comes.
   *
   * "held" is for the sheet, where a title, tags, a folder and a date all sit
   * on top. "lit" is for the decorative sheets, which carry a number and a
   * host and nothing else, and where holding the picture as far back only
   * makes the product look like it has none.
   */
  tone?: "held" | "lit"
}) {
  const letter = host.replace(/^www\./, "").charAt(0).toUpperCase()

  return (
    <>
      <div
        className={`frame-shot${src ? "" : " frame-shot-unexposed"}${
          tone === "lit" ? " frame-shot-lit" : ""
        }`}
        aria-hidden
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" loading="lazy" />
        ) : faviconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={faviconUrl} alt="" loading="lazy" className="frame-mark" />
        ) : letter ? (
          <span className="frame-shot-letter">{letter}</span>
        ) : null}
      </div>

      {scrim === "none" ? null : (
        <>
          {scrim === "both" ? <span className="frame-scrim-top" aria-hidden /> : null}
          <span className="frame-scrim" aria-hidden />
        </>
      )}
    </>
  )
}
