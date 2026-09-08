"use client"

import { useRouter } from "next/navigation"
import { useRef, useState } from "react"

import { importChunk } from "~/app/(dashboard)/actions"
import { IMPORT_CHUNK, parseNetscapeBookmarks, type ParseResult } from "~/lib/netscape"

import { Modal, ModalHeader } from "./Modal"

/**
 * Brings a browser's bookmarks in.
 *
 * The file is parsed here rather than uploaded whole. A large export posted in
 * one piece is a request a serverless function has to finish inside its time
 * limit, and parsing on this side means the preview can be shown before
 * anything at all is written. Nothing is sent until the count has been looked
 * at and confirmed.
 */

type Phase =
  | { at: "picking" }
  | { at: "parsed"; file: string; result: ParseResult }
  | { at: "importing"; done: number; total: number; added: number; alreadyHad: number }
  | { at: "finished"; added: number; alreadyHad: number }

const MAX_FILE_BYTES = 20 * 1024 * 1024

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>({ at: "picking" })
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)

    if (file.size > MAX_FILE_BYTES) {
      setError("That file is larger than 20MB, which is not a bookmark export.")
      return
    }

    const text = await file.text()
    const result = parseNetscapeBookmarks(text)

    if (result.bookmarks.length === 0) {
      setError(
        "No bookmarks in that file. Export from your browser as HTML, which every browser calls something like Export bookmarks to HTML."
      )
      return
    }

    setPhase({ at: "parsed", file: file.name, result })
  }

  async function run(result: ParseResult) {
    setError(null)

    const items = result.bookmarks
    let added = 0
    let alreadyHad = 0

    setPhase({ at: "importing", done: 0, total: items.length, added, alreadyHad })

    for (let i = 0; i < items.length; i += IMPORT_CHUNK) {
      const chunk = items.slice(i, i + IMPORT_CHUNK)
      const outcome = await importChunk(chunk)

      if (!outcome.ok) {
        setError(`${outcome.error} ${added + alreadyHad} of ${items.length} were saved before it stopped.`)
        return
      }

      added += outcome.added
      alreadyHad += outcome.alreadyHad
      setPhase({ at: "importing", done: Math.min(i + IMPORT_CHUNK, items.length), total: items.length, added, alreadyHad })
    }

    setPhase({ at: "finished", added, alreadyHad })
    router.refresh()
  }

  return (
    <Modal label="Import bookmarks" onClose={onClose}>
      <ModalHeader
        eyebrow="Develop a roll"
        detail="Bring in what your browser already has"
        onClose={onClose}
      />

      {phase.at === "picking" ? (
        <div className="mt-5">
          <p className="text-[11px] leading-relaxed text-silver-dim">
            Export your bookmarks as HTML, then pick the file here. Every browser writes the same
            format, so Chrome, Brave, Edge, Firefox and Safari all work.
          </p>

          <dl className="mt-4 space-y-1.5 text-[10.5px] leading-relaxed text-silver-dim">
            <div>
              <dt className="inline text-silver">Chrome, Brave, Edge</dt>
              <dd className="inline">
                {" "}
                Bookmark manager, then the menu at the top right, then Export bookmarks.
              </dd>
            </div>
            <div>
              <dt className="inline text-silver">Firefox</dt>
              <dd className="inline"> Bookmarks, Manage bookmarks, Import and backup, Export to HTML.</dd>
            </div>
          </dl>

          <input
            ref={fileRef}
            type="file"
            accept=".html,.htm,text/html"
            onChange={onPick}
            className="sr-only"
          />

          <button type="button" className="shutter mt-5 w-full" onClick={() => fileRef.current?.click()}>
            Choose a file
          </button>

          <p className="mt-3 text-[10px] leading-relaxed text-silver-dim">
            The file is read in this browser. Nothing is saved until you have seen what is in it.
          </p>
        </div>
      ) : null}

      {phase.at === "parsed" ? (
        <div className="mt-5">
          <p className="frame-stamp">{phase.file}</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Figure value={phase.result.bookmarks.length} label="bookmarks" />
            <Figure value={phase.result.folders.length} label="folders" />
          </div>

          {phase.result.folders.length > 0 ? (
            <p className="mt-3 text-[10.5px] leading-relaxed text-silver-dim">
              Folders: {phase.result.folders.slice(0, 8).join(", ")}
              {phase.result.folders.length > 8 ? ` and ${phase.result.folders.length - 8} more` : ""}. Nested
              ones arrive under their innermost name.
            </p>
          ) : null}

          {Object.keys(phase.result.skipped).length > 0 ? (
            <ul className="mt-3 space-y-1 text-[10.5px] text-silver-dim">
              {Object.entries(phase.result.skipped).map(([reason, count]) => (
                <li key={reason}>
                  Skipped {count} {count === 1 ? "entry" : "entries"}, {reason}.
                </li>
              ))}
            </ul>
          ) : null}

          <p className="mt-4 text-[10.5px] leading-relaxed text-silver-dim">
            Anything you already have keeps its title, note, folder and mark. Importing twice is safe.
          </p>

          <div className="mt-5 flex items-center gap-2">
            <button type="button" className="shutter flex-1" onClick={() => run(phase.result)}>
              Import {phase.result.bookmarks.length}
            </button>
            <button type="button" className="ghost-btn" onClick={() => setPhase({ at: "picking" })}>
              Back
            </button>
          </div>
        </div>
      ) : null}

      {phase.at === "importing" ? (
        <div className="mt-5">
          <p className="label">Developing</p>

          <div className="mt-3 h-1.5 w-full bg-gutter shadow-[inset_0_0_0_1px_var(--line-field)]">
            <div
              className="h-full bg-grease transition-[width] duration-200"
              style={{ width: `${Math.round((phase.done / phase.total) * 100)}%` }}
            />
          </div>

          <p className="mt-3 text-[11px] text-silver tabular-nums">
            {phase.done} of {phase.total}
          </p>
          <p className="mt-1 text-[10.5px] text-silver-dim">
            Leave this open until it finishes, it is sent in batches.
          </p>
        </div>
      ) : null}

      {phase.at === "finished" ? (
        <div className="mt-5">
          <p className="label">Developed</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Figure value={phase.added} label="added" />
            <Figure value={phase.alreadyHad} label="already had" />
          </div>

          <button type="button" className="shutter mt-5 w-full" onClick={onClose}>
            See the sheet
          </button>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="notice mt-4">
          {error}
        </div>
      ) : null}
    </Modal>
  )
}

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div className="frame">
      <p className="font-[family-name:var(--font-head)] text-[26px] leading-none text-print tabular-nums">
        {value}
      </p>
      <p className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-silver-dim">{label}</p>
    </div>
  )
}
