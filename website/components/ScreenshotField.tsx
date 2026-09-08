"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Attaching a picture by hand.
 *
 * The extension captures the tab it is on, and that is the only automatic way
 * a bookmark gets a picture: the site cannot screenshot a page it is not
 * looking at. This is the manual route, and it is the only way to give a frame
 * a real picture when the page is behind a sign in, or when the shot you want
 * is not the one the extension would have taken.
 *
 * The preview is a blob url made here rather than a read of the file, so a
 * three megabyte image does not get turned into a base64 string in memory just
 * to be looked at. It is revoked when the choice changes or the dialog closes,
 * or the browser holds the file until the tab is gone.
 */

const MAX_BYTES = 3 * 1024 * 1024
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"]

export function ScreenshotField({
  existing = null,
  onRemoveExisting
}: {
  /** The picture already on the bookmark, when editing one. */
  existing?: string | null
  /** Set when the existing picture can be taken off. */
  onRemoveExisting?: (removed: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [name, setName] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [removed, setRemoved] = useState(false)

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    setProblem(null)
    if (preview) URL.revokeObjectURL(preview)

    if (!file) {
      setPreview(null)
      setName(null)
      return
    }

    // Checked here as well as on the server, so the answer is immediate rather
    // than arriving after a three megabyte upload.
    if (!ACCEPTED.includes(file.type)) {
      setProblem("That has to be a JPEG, PNG, WebP or GIF.")
      clear()
      return
    }
    if (file.size > MAX_BYTES) {
      setProblem(`That is ${(file.size / 1024 / 1024).toFixed(1)}MB, and the limit is 3MB.`)
      clear()
      return
    }

    setPreview(URL.createObjectURL(file))
    setName(file.name)
    setRemoved(false)
    onRemoveExisting?.(false)
  }

  function clear() {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setName(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  const showingExisting = Boolean(existing) && !preview && !removed

  return (
    <div>
      <span className="label">Picture</span>

      {/* Carries the intent to clear, since an unchanged file input says
          nothing about wanting the old one gone. */}
      {removed ? <input type="hidden" name="removeScreenshot" value="1" /> : null}

      <input
        ref={inputRef}
        type="file"
        name="screenshot"
        accept={ACCEPTED.join(",")}
        onChange={choose}
        className="sr-only"
      />

      {preview || showingExisting ? (
        <div className="mt-2">
          <div className="plate h-28">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview ?? (existing as string)} alt="" />
          </div>

          <div className="mt-2 flex items-center gap-2">
            <button type="button" className="ghost-btn" onClick={() => inputRef.current?.click()}>
              Replace
            </button>

            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                clear()
                if (existing) {
                  setRemoved(true)
                  onRemoveExisting?.(true)
                }
              }}
            >
              Remove
            </button>

            {name ? <span className="truncate frame-stamp">{name}</span> : null}
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <button type="button" className="ghost-btn w-full" onClick={() => inputRef.current?.click()}>
            {removed ? "Choose a different picture" : "Attach a picture"}
          </button>
          <p className="mt-1.5 text-[10px] leading-relaxed text-silver-dim">
            {removed
              ? "The old one comes off when you save."
              : "Optional. The extension takes one for you when it captures a tab, this is for pages it cannot reach."}
          </p>
        </div>
      )}

      {problem ? (
        <p role="alert" className="mt-2 text-[10.5px] text-grease">
          {problem}
        </p>
      ) : null}
    </div>
  )
}
