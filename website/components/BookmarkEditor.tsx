"use client"

import { useEffect, useRef, useState, useTransition } from "react"

import { deleteBookmark, updateBookmark } from "~/app/(dashboard)/actions"
import { hostnameOf, isoDate, prettyPath } from "~/lib/format"
import type { BookmarkWithFolder, Folder } from "~/types/db"

export function BookmarkEditor({
  bookmark,
  folders,
  onClose
}: {
  bookmark: BookmarkWithFolder
  folders: Folder[]
  onClose: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
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

  function onSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await updateBookmark(formData)
      if (result.ok) onClose()
      else setError(result.error)
    })
  }

  const host = hostnameOf(bookmark.url)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-lacquer-deep/80 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${bookmark.title || host}`}
        className="tray w-full max-w-lg p-5 sm:p-7"
      >
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="label-mono text-gold">Compartment</p>
              <p className="mt-1.5 truncate font-[family-name:var(--font-mono)] text-xs text-rice/60">
                {host}
                <span className="text-rice/30">{prettyPath(bookmark.url)}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-m-1 shrink-0 rounded p-1 text-rice/40 transition hover:text-rice"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="m4 4 8 8M12 4l-8 8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {bookmark.screenshot_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bookmark.screenshot_url}
              alt=""
              className="mt-4 h-36 w-full rounded-lg object-cover object-top shadow-[0_0_0_1px_rgba(201,162,74,0.35)]"
            />
          ) : null}

          <form action={onSubmit} className="mt-5 space-y-4">
            <input type="hidden" name="id" value={bookmark.id} />

            <div>
              <label htmlFor="title" className="label-mono text-gold">
                Title
              </label>
              <input
                id="title"
                name="title"
                defaultValue={bookmark.title}
                maxLength={500}
                className="field mt-2 font-[family-name:var(--font-display)] text-[0.95rem]"
              />
            </div>

            <div>
              <label htmlFor="tags" className="label-mono text-gold">
                Tags
              </label>
              <input
                id="tags"
                name="tags"
                defaultValue={bookmark.tags.join(", ")}
                placeholder="comma separated"
                className="field mt-2 font-[family-name:var(--font-mono)] text-xs"
              />
            </div>

            <div>
              <label htmlFor="folder_id" className="label-mono text-gold">
                Folder
              </label>
              <select
                id="folder_id"
                name="folder_id"
                defaultValue={bookmark.folder_id ?? "none"}
                className="field mt-2 text-sm"
              >
                <option value="none">Unfiled</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="notes" className="label-mono text-gold">
                Note
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={4}
                defaultValue={bookmark.notes}
                maxLength={10000}
                placeholder="Why is this worth keeping?"
                className="field mt-2 resize-y text-sm leading-relaxed"
              />
            </div>

            {error ? (
              <p role="alert" className="text-sm text-oxblood-lit">
                {error}
              </p>
            ) : null}

            <div className="seam my-5!" />

            <div className="flex items-center justify-between gap-3">
              <span className="label-mono text-rice/30">Saved {isoDate(bookmark.created_at)}</span>

              <div className="flex items-center gap-2">
                {confirmingDelete ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className="btn-lacquer py-1.5! text-xs"
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setError(null)
                        startTransition(async () => {
                          const result = await deleteBookmark(bookmark.id)
                          if (result.ok) onClose()
                          else setError(result.error)
                        })
                      }}
                      className="btn-seal py-1.5! text-xs"
                    >
                      Delete for good
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(true)}
                      className="btn-lacquer py-1.5! text-xs"
                    >
                      Delete
                    </button>
                    <button type="submit" disabled={pending} className="btn-seal py-1.5! text-sm">
                      {pending ? "Saving" : "Save"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
