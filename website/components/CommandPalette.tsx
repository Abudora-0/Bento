"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"

import { lockNow } from "~/app/lock/actions"
import type { Folder } from "~/types/db"

type Command = {
  id: string
  label: string
  hint: string
  group: string
  run: () => void
}

/**
 * Ctrl or Cmd K.
 *
 * The sheet already had one shortcut, slash to search, and a palette is the
 * natural other half: slash is for finding a page, this is for going somewhere
 * or doing something. Filtering is a plain substring match on the label, not
 * fuzzy: with a couple of dozen commands, fuzzy matching mostly produces
 * surprising ranking rather than useful hits.
 */
export function CommandPalette({ folders, tags }: { folders: Folder[]; tags: string[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((was) => !was)
        setQuery("")
        setActive(0)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (!open) return

    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    inputRef.current?.focus()

    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => {
      setOpen(false)
      router.push(href)
    }

    return [
      { id: "all", label: "Everything", hint: "The whole roll", group: "Go", run: go("/app") },
      { id: "marked", label: "Marked", hint: "Grease pencilled only", group: "Go", run: go("/app?star=1") },
      { id: "unfiled", label: "Unfiled", hint: "Not in a folder", group: "Go", run: go("/app?folder=none") },
      { id: "settings", label: "Settings", hint: "Your extension token", group: "Go", run: go("/settings") },
      ...folders.map((folder) => ({
        id: `folder-${folder.id}`,
        label: folder.name,
        hint: "Folder",
        group: "Filed",
        run: go(`/app?folder=${encodeURIComponent(folder.id)}`)
      })),
      ...tags.map((tag) => ({
        id: `tag-${tag}`,
        label: tag,
        hint: "Tag",
        group: "Tags",
        run: go(`/app?tag=${encodeURIComponent(tag)}`)
      })),
      {
        id: "search",
        label: "Search the sheet",
        hint: "Or press /",
        group: "Do",
        run: () => {
          setOpen(false)
          // Let the palette unmount before the search field asks for focus,
          // or the two fight over it and the caret ends up nowhere.
          setTimeout(() => document.querySelector<HTMLInputElement>('input[type="search"]')?.focus(), 30)
        }
      },
      {
        id: "lock",
        label: "Lock Bento",
        hint: "Drop the session",
        group: "Do",
        run: () => {
          setOpen(false)
          void lockNow()
        }
      }
    ]
  }, [folders, tags, router])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => `${c.label} ${c.group}`.toLowerCase().includes(q))
  }, [commands, query])

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" })
  }, [open, active])

  if (!open) return null

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault()
      setOpen(false)
    } else if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((i) => Math.min(matches.length - 1, i + 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (event.key === "Enter") {
      event.preventDefault()
      matches[active]?.run()
    }
  }

  let lastGroup = ""

  return (
    <div
      className="animate-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gutter/85 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="animate-loupe w-full max-w-lg bg-darkroom"
        style={{ boxShadow: "inset 0 0 0 1px var(--line-live)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-3 pt-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to a folder, a tag, or an action"
            aria-label="Command palette"
            role="combobox"
            aria-expanded
            aria-controls="palette-list"
            className="field"
          />
        </div>

        <ul id="palette-list" ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto p-3">
          {matches.length === 0 ? (
            <li className="px-2 py-6 text-center text-[11px] text-silver-dim">Nothing matches that.</li>
          ) : (
            matches.map((command, i) => {
              const heading = command.group !== lastGroup ? command.group : null
              lastGroup = command.group

              return (
                <li key={command.id}>
                  {heading ? (
                    <p className="label mt-3 px-2 pb-1 first:mt-0">{heading}</p>
                  ) : null}
                  <div
                    role="option"
                    aria-selected={i === active}
                    data-active={i === active}
                    className="select-option justify-between"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      command.run()
                    }}
                    onMouseEnter={() => setActive(i)}
                  >
                    <span className="truncate">{command.label}</span>
                    <span className="shrink-0 pl-3 text-[9px] uppercase tracking-[0.14em] text-silver-dim">
                      {command.hint}
                    </span>
                  </div>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </div>
  )
}
