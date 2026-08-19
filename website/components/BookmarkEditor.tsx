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
        eyebrow="Compartment"
        detail={
          <>
            {host}
            <span className="text-rice/30">{prettyPath(bookmark.url)}</span>
          </>
        }
        onClose={onClose}
      />

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
    </Modal>
  )
}
