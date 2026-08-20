"use client"

import { useEffect, useRef } from "react"

/**
 * The panel every dialog on the site sits in. Owns the parts that are easy to
 * forget: escape to close, a locked page behind it, a click on the backdrop,
 * and focus landing on the first field rather than the document.
 *
 * The panel scales in like a loupe coming down onto the sheet.
 */
export function Modal({
  label,
  onClose,
  children,
  width = "max-w-lg"
}: {
  label: string
  onClose: () => void
  children: React.ReactNode
  width?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }

    document.addEventListener("keydown", onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>("input, textarea, select")?.focus()
  }, [])

  return (
    <div
      className="animate-backdrop fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-gutter/85 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`animate-loupe w-full bg-darkroom p-5 shadow-[inset_0_0_0_1px_var(--line-live)] sm:p-7 ${width}`}
      >
        {children}
      </div>
    </div>
  )
}

/** Shared dialog header: a wide tracked label, a line of detail, and a close cross. */
export function ModalHeader({
  eyebrow,
  detail,
  onClose
}: {
  eyebrow: string
  detail?: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="label">{eyebrow}</p>
        {detail ? (
          <p className="mt-2 truncate font-[family-name:var(--font-mono)] text-[11px] text-silver">
            {detail}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="-m-1 shrink-0 p-1 text-silver-dim transition hover:text-print"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="m4 4 8 8M12 4l-8 8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
