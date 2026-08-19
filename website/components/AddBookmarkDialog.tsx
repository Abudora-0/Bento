"use client"

import { useState, useTransition } from "react"

import { createBookmark } from "~/app/(dashboard)/actions"
import type { Folder } from "~/types/db"

import { Modal, ModalHeader } from "./Modal"

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

  function onSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await createBookmark(formData)
      if (result.ok) onClose()
      else setError(result.error)
    })
  }

  return (
    <Modal label="Add a bookmark" onClose={onClose}>
      <ModalHeader
        eyebrow="New compartment"
        detail="Paste an address, the rest is optional"
        onClose={onClose}
      />

      <form action={onSubmit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="add-url" className="label-mono text-gold">
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
            className="field mt-2 font-[family-name:var(--font-mono)] text-xs"
          />
        </div>

        <div>
          <label htmlFor="add-title" className="label-mono text-gold">
            Title
          </label>
          <input
            id="add-title"
            name="title"
            maxLength={500}
            placeholder="Left blank, the site name is used"
            className="field mt-2 font-[family-name:var(--font-display)] text-[0.95rem]"
          />
        </div>

        <div>
          <label htmlFor="add-tags" className="label-mono text-gold">
            Tags
          </label>
          <input
            id="add-tags"
            name="tags"
            placeholder="comma separated"
            className="field mt-2 font-[family-name:var(--font-mono)] text-xs"
          />
        </div>

        <div>
          <label htmlFor="add-folder" className="label-mono text-gold">
            Folder
          </label>
          <select
            id="add-folder"
            name="folder_id"
            defaultValue={defaultFolderId ?? "none"}
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
          <label htmlFor="add-notes" className="label-mono text-gold">
            Note
          </label>
          <textarea
            id="add-notes"
            name="notes"
            rows={3}
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
          <span className="label-mono text-rice/30">Saving twice merges</span>

          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn-lacquer py-1.5! text-xs">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="btn-seal py-1.5! text-sm">
              {pending ? "Saving" : "Add to tray"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
