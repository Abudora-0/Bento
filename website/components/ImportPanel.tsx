"use client"

import { useState } from "react"

import { ImportDialog } from "./ImportDialog"

/**
 * The way in to the import, from a server rendered page.
 *
 * The dialog is client only because it reads a file and posts it in pieces, so
 * this thin wrapper is what a server component can drop onto the page.
 *
 * `compact` is the one line version for the empty sheet, where a whole panel
 * would compete with the thing the page is actually about.
 */
export function ImportPanel({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false)

  if (compact) {
    return (
      <>
        <button type="button" className="ghost-btn mt-3" onClick={() => setOpen(true)}>
          Import from your browser
        </button>
        {open ? <ImportDialog onClose={() => setOpen(false)} /> : null}
      </>
    )
  }

  return (
    <div className="frame">
      <div className="relative flex items-center justify-between gap-2">
        <span className="frame-no">03</span>
        <span className="frame-stamp">one file</span>
      </div>

      <h3 className="head-3 mt-3">Bring what you already have</h3>

      <p className="mt-2 text-[11px] leading-relaxed text-silver-dim">
        Export your bookmarks from Chrome, Brave, Edge, Firefox or Safari and drop the file in.
        Folders come with them, and anything you already have is left exactly as it is.
      </p>

      <button type="button" className="shutter mt-4" onClick={() => setOpen(true)}>
        Import bookmarks
      </button>

      {open ? <ImportDialog onClose={() => setOpen(false)} /> : null}
    </div>
  )
}
