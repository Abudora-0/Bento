"use client"

import { useEffect, useId, useRef, useState } from "react"

/**
 * The only dropdown in the project.
 *
 * A native select cannot be themed past its closed state. `appearance: none`
 * gets rid of the chevron, and that is where it stops: the popup list is drawn
 * by the operating system, with its own rounded corners, its own highlight
 * colour and its own type. In a design whose entire premise is hard rectangles
 * on a hairline ladder, that list was the most obviously foreign thing on the
 * page.
 *
 * So this is a real listbox. It costs the keyboard handling a native select
 * gives away for free, which is why there is exactly one of these and every
 * picker in the app goes through it.
 *
 * It keeps a hidden input carrying the value, so the two dialogs that submit
 * through a plain form action still see the field they expect.
 */

export type SelectOption = { value: string; label: string }

/**
 * Folders as options, with Unfiled at the top.
 *
 * "none" rather than an empty string, because an empty value would be
 * indistinguishable from the field not having been submitted at all, and the
 * server actions already read "none" as unfiled.
 */
export function folderOptions(folders: { id: string; name: string }[]): SelectOption[] {
  return [{ value: "none", label: "Unfiled" }, ...folders.map((f) => ({ value: f.id, label: f.name }))]
}

export function Select({
  id,
  name,
  value,
  options,
  onChange,
  ariaLabel,
  className = ""
}: {
  id?: string
  /** When set, a hidden input of this name carries the value into a form submit. */
  name?: string
  value: string
  options: SelectOption[]
  onChange?: (value: string) => void
  ariaLabel?: string
  className?: string
}) {
  const generatedId = useId()
  const listId = `${generatedId}-list`
  const buttonId = id ?? `${generatedId}-button`

  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)))

  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  /*
   * Typeahead. A native select lets you jump to an option by typing its first
   * letters, and losing that would be a downgrade people notice without being
   * able to name it.
   */
  const typed = useRef({ text: "", at: 0 })

  const selected = options.find((o) => o.value === value) ?? options[0]

  function choose(index: number): void {
    const option = options[index]
    if (!option) return

    onChange?.(option.value)
    close()
  }

  function close(): void {
    setOpen(false)
    buttonRef.current?.focus()
  }

  function openAt(index: number): void {
    setActive(Math.max(0, index))
    setOpen(true)
  }

  // Clicking away closes it. Pointerdown rather than click, so it closes on the
  // press rather than waiting for a release that might land somewhere else.
  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    window.addEventListener("pointerdown", onPointerDown)
    return () => window.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  // Keep the active option in view when arrowing past the edge of the popup.
  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" })
  }, [open, active])

  function onKeyDown(event: React.KeyboardEvent): void {
    const current = options.findIndex((o) => o.value === value)

    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault()
        openAt(current)
      }
      return
    }

    switch (event.key) {
      case "Escape":
        event.preventDefault()
        close()
        return
      case "Tab":
        // Let focus move on, but do not leave a popup hanging open behind it.
        setOpen(false)
        return
      case "Enter":
      case " ":
        event.preventDefault()
        choose(active)
        return
      case "ArrowDown":
        event.preventDefault()
        setActive((i) => Math.min(options.length - 1, i + 1))
        return
      case "ArrowUp":
        event.preventDefault()
        setActive((i) => Math.max(0, i - 1))
        return
      case "Home":
        event.preventDefault()
        setActive(0)
        return
      case "End":
        event.preventDefault()
        setActive(options.length - 1)
        return
    }

    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const now = Date.now()
      // A pause resets the buffer, so "re" then later "a" is a fresh search.
      typed.current.text = now - typed.current.at > 700 ? event.key : typed.current.text + event.key
      typed.current.at = now

      const match = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text.toLowerCase()))
      if (match >= 0) setActive(match)
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {name ? <input type="hidden" name={name} value={value} /> : null}

      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        role="combobox"
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className="field select-button"
        onClick={() => (open ? setOpen(false) : openAt(options.findIndex((o) => o.value === value)))}
        onKeyDown={onKeyDown}
      >
        <span className="truncate">{selected?.label ?? ""}</span>
        <span className="select-chevron" aria-hidden />
      </button>

      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={`${listId}-${active}`}
          className="select-list animate-loupe"
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.value === value}
              data-active={index === active}
              className="select-option"
              /*
               * Mousedown, not click. The button still holds focus while the
               * popup is open, and a click would fire after the pointerdown
               * listener above had already closed it.
               */
              onMouseDown={(event) => {
                event.preventDefault()
                choose(index)
              }}
              onMouseEnter={() => setActive(index)}
            >
              <span className="select-tick" aria-hidden />
              <span className="truncate">{option.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
