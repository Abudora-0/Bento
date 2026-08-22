"use client"

import { useState, useTransition } from "react"

import { createBookmark } from "~/app/(dashboard)/actions"
import type { Folder } from "~/types/db"

import { Modal, ModalHeader } from "./Modal"
import { Select, folderOptions } from "./Select"

/**
 * Adds a bookmark by hand. The extension is the fast path, but the site cannot
 * depend on it: plenty of people will land here first, and the browser refuses
 * to let any extension capture its own pages anyway.
 */
export function AddBookmarkDialog({
  folders,
  defaultFolderId,
  onClose
}: {
  folders: Folder[]
  defaultFolderId: string | null
  onClose: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [folderId, setFolderId] = useState(defaultFolderId ?? "none")

  /*
   * A submit handler rather than <form action={fn}>. React clears an
   * uncontrolled form once its action prop resolves, which is right when the
   * dialog closes and wrong when it does not: a rejected save would wipe the
   * address, the tags and the note along with it.
   */
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await createBookmark(formData)
      if (result.ok) onClose()
      else setError(result.error)
    })
  }

  return (
    <Modal label="Add a bookmark" onClose={onClose}>
      <ModalHeader eyebrow="New frame" detail="Paste an address, the rest is optional" onClose={onClose} />

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="add-url" className="label">
            Address
          </label>
          <input
            id="add-url"
            name="url"
            required
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="example.com/the-page"
            className="field mt-2"
          />
        </div>

        <div>
          <label htmlFor="add-title" className="label">
            Title
          </label>
          <input
            id="add-title"
            name="title"
            maxLength={500}
            placeholder="Left blank, the site name is used"
            className="field mt-2 font-[family-name:var(--font-head)] text-[15px]"
          />
        </div>

        <div>
          <label htmlFor="add-tags" className="label">
            Tags
          </label>
          <input id="add-tags" name="tags" placeholder="comma separated" className="field mt-2" />
        </div>

        <div>
          <label htmlFor="add-folder" className="label">
            Filed under
          </label>
          <Select
            id="add-folder"
            name="folder_id"
            ariaLabel="Filed under"
            value={folderId}
            options={folderOptions(folders)}
            onChange={setFolderId}
            className="mt-2"
          />
        </div>

        <div>
          <label htmlFor="add-notes" className="label">
            Note
          </label>
          <textarea
            id="add-notes"
            name="notes"
            rows={3}
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
          <span>Saving twice merges</span>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="ghost-btn">
            Cancel
          </button>
          <button type="submit" disabled={pending} className="shutter">
            {pending ? "Exposing" : "Expose"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
