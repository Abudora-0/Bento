"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useRef, useState, useTransition } from "react"

import { createFolder, deleteFolder, renameFolder } from "~/app/(dashboard)/actions"
import { trayHref } from "~/lib/query"
import type { Folder } from "~/types/db"

/** The roll index. Which part of the sheet you are looking at. */
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
      <div className="section-rule mb-3">
        <span>The roll</span>
      </div>

      <nav aria-label="Filters" className="space-y-px">
        <RailLink
          href={trayHref(searchParams, { folder: null, star: null })}
          active={!activeFolder && !starredOnly}
        >
          Everything
        </RailLink>

        <RailLink href={trayHref(searchParams, { star: starredOnly ? null : "1" })} active={starredOnly}>
          Marked
        </RailLink>

        <RailLink
          href={trayHref(searchParams, { folder: activeFolder === "none" ? null : "none" })}
          active={activeFolder === "none"}
        >
          Unfiled
        </RailLink>
      </nav>

      <div className="section-rule mb-2 mt-5">
        <span>Filed</span>
      </div>

      <ul className="space-y-px">
        {folders.length === 0 ? (
          <li className="px-2.5 py-1.5 font-[family-name:var(--font-mono)] text-[10px] text-silver-dim">
            None yet.
          </li>
        ) : null}

        {folders.map((folder) => (
          <li key={folder.id}>
            {editing === folder.id ? (
              <RenameRow folder={folder} onDone={() => setEditing(null)} onError={setError} />
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
                  className="p-1 text-silver-dim opacity-0 transition hover:text-print focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <PencilIcon />
                </button>

                <button
                  type="button"
                  aria-label={`Delete ${folder.name}`}
                  title="Delete, the frames inside become unfiled"
                  disabled={pending}
                  onClick={() => {
                    setError(null)
                    startTransition(async () => {
                      const result = await deleteFolder(folder.id)
                      if (!result.ok) setError(result.error)
                    })
                  }}
                  className="p-1 text-silver-dim opacity-0 transition hover:text-grease focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <TrashIcon />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <form ref={formRef} action={onCreate} className="mt-3 flex gap-1">
        <input
          name="name"
          maxLength={60}
          required
          placeholder="New folder"
          className="field px-2! py-1.5! text-[11px]"
        />
        <button type="submit" disabled={pending} className="ghost-btn px-2.5! py-1.5!">
          Add
        </button>
      </form>

      {error ? (
        <p role="alert" className="notice mt-2">
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
      className={`block px-2.5 py-1.5 font-[family-name:var(--font-mono)] text-[11px] transition ${
        active
          ? "bg-darkroom text-print shadow-[inset_0_0_0_1px_var(--line-live)]"
          : "text-silver-dim hover:bg-darkroom/60 hover:text-print"
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
      className="flex gap-1"
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
        className="field px-2! py-1.5! text-[11px]"
      />
      <button type="submit" disabled={pending} className="ghost-btn px-2! py-1.5!">
        Save
      </button>
    </form>
  )
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden
    >
      <path d="M11.2 2.5 13.5 4.8 5.6 12.7l-3 .7.7-3z" strokeLinejoin="round" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden
    >
      <path
        d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
