"use client"

import { useState, useTransition } from "react"

import { deleteBookmark, updateBookmark } from "~/app/(dashboard)/actions"
import { hostnameOf, isoDate, prettyPath } from "~/lib/format"
import type { BookmarkWithFolder, Folder } from "~/types/db"

import { Modal, ModalHeader } from "./Modal"

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
    <Modal label={`Edit ${bookmark.title || host}`} onClose={onClose}>
      <ModalHeader
        eyebrow="Frame"
        detail={
          <>
            {host}
            <span className="text-silver-dim">{prettyPath(bookmark.url)}</span>
          </>
        }
        onClose={onClose}
      />

      {bookmark.screenshot_url ? (
        <div className="plate mt-4 h-36">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bookmark.screenshot_url} alt="" />
        </div>
      ) : null}

      <form action={onSubmit} className="mt-5 space-y-4">
        <input type="hidden" name="id" value={bookmark.id} />

        <div>
          <label htmlFor="title" className="label">
            Title
          </label>
          <input
            id="title"
            name="title"
            defaultValue={bookmark.title}
            maxLength={500}
            className="field mt-2 font-[family-name:var(--font-head)] text-[15px]"
          />
        </div>

        <div>
          <label htmlFor="tags" className="label">
            Tags
          </label>
          <input
            id="tags"
            name="tags"
            defaultValue={bookmark.tags.join(", ")}
            placeholder="comma separated"
            className="field mt-2"
          />
        </div>

        <div>
          <label htmlFor="folder_id" className="label">
            Filed under
          </label>
          <select
            id="folder_id"
            name="folder_id"
            defaultValue={bookmark.folder_id ?? "none"}
            className="field mt-2 cursor-pointer"
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
          <label htmlFor="notes" className="label">
            Note
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            defaultValue={bookmark.notes}
            maxLength={10000}
            placeholder="Why is this worth keeping?"
            className="field mt-2"
          />
        </div>

        {error ? (
          <div role="alert" className="notice">
            {error}
          </div>
        ) : null}

        <div className="section-rule pt-2">
          <span>{isoDate(bookmark.created_at)}</span>
        </div>

        <div className="flex items-center justify-end gap-2">
          {confirmingDelete ? (
            <>
              <button type="button" onClick={() => setConfirmingDelete(false)} className="ghost-btn">
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
                className="shutter text-[11px]"
              >
                Delete for good
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setConfirmingDelete(true)} className="ghost-btn">
                Delete
              </button>
              <button type="submit" disabled={pending} className="shutter">
                {pending ? "Saving" : "Save"}
              </button>
            </>
          )}
        </div>
      </form>
    </Modal>
  )
}
