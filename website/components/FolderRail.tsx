"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useRef, useState, useTransition } from "react"

import { createFolder, deleteFolder, renameFolder } from "~/app/(dashboard)/actions"
import { trayHref } from "~/lib/query"
import type { Folder } from "~/types/db"

export function FolderRail({
  folders,
  activeFolder,
  starredOnly
}: {
  folders: Folder[]
  activeFolder: string
  starredOnly: boolean
}) {
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function onCreate(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await createFolder(formData)
      if (!result.ok) setError(result.error)
      else formRef.current?.reset()
    })
  }

  return (
    <aside className="lg:sticky lg:top-5">
      <nav aria-label="Filters" className="space-y-1">
        <RailLink href={trayHref(searchParams, { folder: null, star: null })} active={!activeFolder && !starredOnly}>
          Everything
        </RailLink>

        <RailLink href={trayHref(searchParams, { star: starredOnly ? null : "1" })} active={starredOnly}>
          <span className="flex items-center gap-2">
            <SealDot /> Starred
          </span>
        </RailLink>

        <RailLink
          href={trayHref(searchParams, { folder: activeFolder === "none" ? null : "none" })}
          active={activeFolder === "none"}
        >
          Unfiled
        </RailLink>
      </nav>

      <div className="seam my-4" />

      <h2 className="label-mono px-2 text-gold/70">Folders</h2>

      <ul className="mt-2 space-y-1">
        {folders.length === 0 ? (
          <li className="px-2 py-1 text-xs text-rice/35">None yet.</li>
        ) : null}

        {folders.map((folder) => (
          <li key={folder.id}>
            {editing === folder.id ? (
              <RenameRow
                folder={folder}
                onDone={() => setEditing(null)}
                onError={setError}
              />
            ) : (
              <div className="group flex items-center gap-1">
                <RailLink
                  href={trayHref(searchParams, { folder: folder.id })}
                  active={activeFolder === folder.id}
                  className="min-w-0 flex-1"
                >
                  <span className="block truncate">{folder.name}</span>
                </RailLink>

                <button
                  type="button"
                  aria-label={`Rename ${folder.name}`}
                  title="Rename"
                  onClick={() => setEditing(folder.id)}
                  className="rounded p-1 text-rice/25 opacity-0 transition hover:text-gold focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <PencilIcon />
                </button>

                <button
                  type="button"
                  aria-label={`Delete ${folder.name}`}
                  title="Delete, the bookmarks inside become unfiled"
                  disabled={pending}
                  onClick={() => {
                    setError(null)
                    startTransition(async () => {
                      const result = await deleteFolder(folder.id)
                      if (!result.ok) setError(result.error)
                    })
                  }}
                  className="rounded p-1 text-rice/25 opacity-0 transition hover:text-oxblood-lit focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <TrashIcon />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <form ref={formRef} action={onCreate} className="mt-3 flex gap-1.5">
        <input
          name="name"
          maxLength={60}
          required
          placeholder="New folder"
          className="field px-2.5! py-1.5! text-xs"
        />
        <button type="submit" disabled={pending} className="btn-lacquer px-3! py-1.5! text-xs">
          Add
        </button>
      </form>

      {error ? (
        <p role="alert" className="mt-2 px-1 text-xs leading-snug text-oxblood-lit">
          {error}
        </p>
      ) : null}
    </aside>
  )
}

function RailLink({
  href,
  active,
  className = "",
  children
}: {
  href: string
  active: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`block rounded-lg px-2.5 py-1.5 text-sm transition ${
        active
          ? "bg-oxblood/45 text-rice shadow-[inset_0_0_0_1px_rgba(201,162,74,0.5)]"
          : "text-rice/55 hover:bg-rice/[0.04] hover:text-rice"
      } ${className}`}
    >
      {children}
    </Link>
  )
}

function RenameRow({
  folder,
  onDone,
  onError
}: {
  folder: Folder
  onDone: () => void
  onError: (message: string) => void
}) {
  const [value, setValue] = useState(folder.name)
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="flex gap-1.5"
      onSubmit={(event) => {
        event.preventDefault()
        startTransition(async () => {
          const result = await renameFolder(folder.id, value)
          if (!result.ok) onError(result.error)
          onDone()
        })
      }}
    >
      <input
        autoFocus
        value={value}
        maxLength={60}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onDone()
        }}
        className="field px-2.5! py-1.5! text-xs"
      />
      <button type="submit" disabled={pending} className="btn-lacquer px-2.5! py-1.5! text-xs">
        Save
      </button>
    </form>
  )
}

function SealDot() {
  return (
    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden>
      <circle cx="6" cy="6" r="5" fill="#7e2024" stroke="#c9a24a" strokeWidth="1" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path d="M11.2 2.5 13.5 4.8 5.6 12.7l-3 .7.7-3z" strokeLinejoin="round" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
