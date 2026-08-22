// Latin only. The full entrypoints drag in cyrillic and vietnamese subsets,
// which triples the size of a popup nobody waits around for.
import "@fontsource/ibm-plex-mono/latin-400.css"
import "@fontsource/ibm-plex-mono/latin-500.css"
import "@fontsource/oswald/latin-400.css"
import "@fontsource/oswald/latin-500.css"
import "@fontsource/oswald/latin-600.css"
import "./popup.css"

import { useCallback, useEffect, useRef, useState } from "react"

import { listFolders, recentCaptures, saveCapture, setStarred } from "./lib/api"
import { getActiveTab, grabScreenshot, hostnameOf, lastFolder, rememberFolder, type ActiveTab } from "./lib/capture"
import { getConfig, setConfig, testConnection, type Config } from "./lib/config"
import type { Bookmark, Folder } from "./lib/types"

export default function Popup() {
  const [config, setConfigState] = useState<Config | null | undefined>(undefined)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    let active = true
    getConfig().then((c) => {
      if (active) setConfigState(c)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="sheet">
      <Leader />
      {config === undefined ? (
        <div className="empty">Loading the roll</div>
      ) : config === null || editing ? (
        <Connect
          initial={config ?? undefined}
          onConnected={(next) => {
            setConfigState(next)
            setEditing(false)
          }}
        />
      ) : (
        <Darkroom config={config} onEditSettings={() => setEditing(true)} />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Leader                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The mark and the wordmark, the same drawing the website uses.
 *
 * Copied rather than imported: the two surfaces are separate npm projects with
 * no shared build step, which is the same reason lib/types.ts is a hand kept
 * mirror. If you change one, change the other, and change
 * website/public/icon.svg and scripts/make-icon.mjs with them.
 */
function Mark() {
  return (
    <svg viewBox="0 0 64 64" className="leader-logo" aria-hidden focusable="false">
      <rect x="8" y="8" width="27" height="48" fill="var(--print-cream)" />
      <rect x="39" y="8" width="17" height="19" fill="var(--silver-dim)" />
      <rect x="39" y="31" width="17" height="25" fill="var(--print-cream)" />
      <g transform="translate(21.5,32) scale(1.18) translate(-15,-15)">
        <path
          d="M20.8 5.9c4.4 1.6 6.4 6.7 4.6 11.1c-1.9 4.6-7.4 7.3-12.2 6.1C8.2 21.9 5 17.2 5.7 12.4C6.4 7.8 10.8 4.4 15.6 4.6c3.4.1 6.7 1.7 8.5 4.3c.5.8.9 1.6 1.1 2.5"
          fill="none"
          stroke="var(--grease)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}

function Letters() {
  return (
    <svg viewBox="0 0 118 23" className="leader-letters" aria-label="Bento" role="img">
        <g transform="translate(0,0)">
          <path d="M0 0h11.4c4.2 0 6.6 2.1 6.6 5.9c0 2.5-1.1 4.2-3.2 5.1c2.6.8 4 2.7 4 5.6c0 4.2-2.6 6.4-7.2 6.4H0V0zm5.6 4.3v4.6h4.5c1.6 0 2.5-.8 2.5-2.3c0-1.5-.9-2.3-2.5-2.3H5.6zm0 8.8v5.4h5c1.8 0 2.8-.9 2.8-2.7c0-1.8-1-2.7-2.8-2.7h-5z" fill="var(--print-cream)" />
          <rect x="-1" y="10.2" width="23" height="1.6" fill="var(--gutter)" />
        </g>
        <g transform="translate(25,0)">
          <path d="M0 0h16.6v4.5H5.6v4.3h9.9v4.4H5.6v5.3h11.3V23H0V0z" fill="var(--print-cream)" />
          <rect x="-1" y="10.2" width="23" height="1.6" fill="var(--gutter)" />
        </g>
        <g transform="translate(49,0)">
          <path d="M0 0h5.3l8.1 13.1V0h5.5v23h-5.3L5.5 9.9V23H0V0z" fill="var(--print-cream)" />
          <rect x="-1" y="10.2" width="23" height="1.6" fill="var(--gutter)" />
        </g>
        <g transform="translate(75,0)">
          <path d="M0 0h18.6v4.6h-6.5V23H6.5V4.6H0V0z" fill="var(--print-cream)" />
          <rect x="-1" y="10.2" width="23" height="1.6" fill="var(--gutter)" />
        </g>
        <g transform="translate(97,0)">
          <path d="M9.9 0C16 0 20 4.6 20 11.5C20 18.4 16 23 9.9 23C3.9 23 0 18.4 0 11.5C0 4.6 3.9 0 9.9 0zm0 4.7c-2.6 0-4.2 2.5-4.2 6.8c0 4.3 1.6 6.8 4.2 6.8c2.7 0 4.3-2.5 4.3-6.8c0-4.3-1.6-6.8-4.3-6.8z" fill="var(--print-cream)" />
          <rect x="-1" y="10.2" width="23" height="1.6" fill="var(--gutter)" />
        </g>
    </svg>
  )
}

function Leader() {
  return (
    <>
      <div className="leader">
        <div className="leader-mark">
          <Mark />
          <Letters />
          <span className="leader-roll">Roll 01</span>
        </div>
        <span className="leader-count">ISO 400</span>
      </div>
      <div className="perf-row" aria-hidden>
        {Array.from({ length: 22 }, (_, i) => (
          <span key={i} />
        ))}
      </div>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Connect. Not a sign in, the account already exists on the site, this pairs  */
/* the browser to it with a token you can revoke without changing a password  */
/* -------------------------------------------------------------------------- */

function Connect({
  initial,
  onConnected
}: {
  initial?: Config
  onConnected: (config: Config) => void
}) {
  const [siteUrl, setSiteUrl] = useState(initial?.siteUrl ?? "")
  const [token, setToken] = useState(initial?.token ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    const config: Config = { siteUrl: siteUrl.trim().replace(/\/$/, ""), token: token.trim() }
    const result = await testConnection(config)

    if (result.ok) {
      await setConfig(config)
      onConnected(config)
    } else {
      setError(result.error)
    }

    setBusy(false)
  }

  return (
    <div className="pad">
      <h1 className="head-2">Load the film</h1>
      <p className="lede">
        Point this at your Bento site and paste your extension token. Sign in on the site, open
        Settings, and copy it from there. It is not your password.
      </p>

      <form onSubmit={submit} className="stack" style={{ marginTop: 14 }}>
        <div>
          <label className="label" htmlFor="site-url">
            Site address
          </label>
          <input
            id="site-url"
            className="field"
            type="url"
            required
            placeholder="https://bento.example.com"
            autoComplete="off"
            spellCheck={false}
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="token">
            Extension token
          </label>
          <input
            id="token"
            className="field"
            type="password"
            required
            autoComplete="off"
            spellCheck={false}
            placeholder="Settings on the site, Extension token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>

        {error ? <div className="notice">{error}</div> : null}

        <button className="shutter" type="submit" disabled={busy}>
          {busy ? "Checking" : "Connect"}
        </button>
      </form>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Darkroom, the connected popup                                               */
/* -------------------------------------------------------------------------- */

function Darkroom({ config, onEditSettings }: { config: Config; onEditSettings: () => void }) {
  const [tab, setTab] = useState<ActiveTab | null>(null)
  const [tabChecked, setTabChecked] = useState(false)
  const [shot, setShot] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const [tags, setTags] = useState("")
  const [notes, setNotes] = useState("")

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const [recent, setRecent] = useState<Bookmark[]>([])
  const [total, setTotal] = useState(0)

  const [folders, setFolders] = useState<Folder[]>([])
  const [folderId, setFolderId] = useState<string | null>(null)

  const previewRef = useRef<string | null>(null)

  const refreshStrip = useCallback(async () => {
    const { bookmarks, total: count } = await recentCaptures(config, 12)
    setRecent(bookmarks)
    setTotal(count)
  }, [config])

  useEffect(() => {
    let active = true

    ;(async () => {
      const activeTab = await getActiveTab()
      if (!active) return

      setTab(activeTab)
      setTabChecked(true)

      if (activeTab) {
        const blob = await grabScreenshot(activeTab.windowId)
        if (!active) return

        if (blob) {
          const url = URL.createObjectURL(blob)
          previewRef.current = url
          setShot(blob)
          setPreview(url)
        }
      }

      const [rows, remembered] = await Promise.all([listFolders(config), lastFolder()])
      if (!active) return

      setFolders(rows)
      // A folder deleted on the website leaves a stale id behind here.
      setFolderId(rows.some((f) => f.id === remembered) ? remembered : null)

      await refreshStrip()
    })()

    return () => {
      active = false
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    }
  }, [config, refreshStrip])

  async function expose() {
    if (!tab) return

    setSaving(true)
    setError(null)
    setSaved(null)

    const result = await saveCapture(config, {
      url: tab.url,
      title: tab.title,
      faviconUrl: tab.faviconUrl,
      tags,
      notes,
      screenshot: shot,
      folderId
    })

    if (result.ok) {
      setSaved(result.updated ? "Frame updated on the sheet." : "Frame exposed.")
      setTags("")
      setNotes("")

      if (result.folderWasStale) {
        setFolderId(null)
        await rememberFolder(null)
      }

      await refreshStrip()
    } else {
      setError(result.error)
    }

    setSaving(false)
  }

  async function toggleGrease(bookmark: Bookmark) {
    const next = !bookmark.starred

    setRecent((rows) => rows.map((r) => (r.id === bookmark.id ? { ...r, starred: next } : r)))

    const ok = await setStarred(config, bookmark.id, next)
    if (!ok) {
      setRecent((rows) => rows.map((r) => (r.id === bookmark.id ? { ...r, starred: !next } : r)))
    }
  }

  return (
    <>
      <div className="scroll">
        <div className="section-rule">
          <span>Frame to expose</span>
        </div>

        {!tabChecked ? (
          <div className="empty">Metering the light</div>
        ) : !tab ? (
          <div className="empty">
            This page cannot be captured. Chrome keeps its own pages, the web store and local files
            off limits. Open a normal http or https page and try again.
          </div>
        ) : (
          <div className="frame frame-live">
            <div className="frame-head">
              <span className="frame-no">{String(total + 1).padStart(2, "0")}A</span>
              <span className="frame-stamp">{hostnameOf(tab.url)}</span>
            </div>

            <div className="plate">
              {preview ? (
                <img src={preview} alt="" />
              ) : (
                <div className="plate plate-empty" style={{ boxShadow: "none" }}>
                  No exposure
                </div>
              )}
            </div>

            <div className="frame-title">{tab.title || hostnameOf(tab.url)}</div>
            <div className="frame-url">{tab.url}</div>

            <div className="stack">
              <div className="filed-row">
                <label className="filed-label" htmlFor="capture-folder">
                  Filed under
                </label>
                <select
                  id="capture-folder"
                  className="field filed-select"
                  value={folderId ?? ""}
                  onChange={(e) => {
                    const next = e.target.value || null
                    setFolderId(next)
                    // Persist immediately, so the keyboard shortcut agrees even
                    // if this popup is closed without capturing.
                    void rememberFolder(next)
                  }}
                >
                  <option value="">Unfiled</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </div>

              <input
                className="field"
                placeholder="tags, comma separated"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void expose()
                }}
              />
              <textarea
                className="field"
                rows={2}
                placeholder="a note for later"
                value={notes}
                maxLength={10000}
                onChange={(e) => setNotes(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void expose()
                }}
              />
            </div>

            <button className="shutter" onClick={expose} disabled={saving}>
              {saving ? "Exposing" : "Capture"}
            </button>
          </div>
        )}

        {error ? <div className="notice">{error}</div> : null}
        {saved ? <div className="notice notice-ok">{saved}</div> : null}

        <div className="section-rule">
          <span>Contact sheet</span>
        </div>

        {recent.length === 0 ? (
          <div className="empty">Nothing on the sheet yet. Capture a tab and it prints here.</div>
        ) : (
          recent.map((bookmark, index) => (
            <StripFrame
              key={bookmark.id}
              bookmark={bookmark}
              number={total - index}
              folderName={folders.find((f) => f.id === bookmark.folder_id)?.name ?? null}
              onToggle={() => toggleGrease(bookmark)}
            />
          ))
        )}
      </div>

      <div className="footer">
        <a href={`${config.siteUrl}/app`} target="_blank" rel="noreferrer">
          Open the tray
        </a>
        <button className="ghost" onClick={onEditSettings}>
          Settings
        </button>
      </div>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* One frame on the contact sheet                                              */
/* -------------------------------------------------------------------------- */

function StripFrame({
  bookmark,
  number,
  folderName,
  onToggle
}: {
  bookmark: Bookmark
  number: number
  folderName: string | null
  onToggle: () => void
}) {
  const host = hostnameOf(bookmark.url)
  const stamp = bookmark.created_at.slice(0, 10)

  return (
    <div className="frame">
      <div className="frame-head">
        <span className="frame-no">{String(Math.max(number, 1)).padStart(2, "0")}</span>
        <span className="frame-stamp">{stamp}</span>
      </div>

      <div className="strip-item">
        {bookmark.screenshot_url ? (
          <div className="plate plate-small">
            <img src={bookmark.screenshot_url} alt="" loading="lazy" />
          </div>
        ) : (
          <div className="plate plate-small plate-empty">n/a</div>
        )}

        <div className="strip-body">
          <a
            href={bookmark.url}
            target="_blank"
            rel="noreferrer"
            className="strip-title"
            style={{ textDecoration: "none", display: "block" }}
          >
            {bookmark.title || host}
          </a>
          <div className="strip-meta">
            {host}
            {folderName ? <span className="strip-folder">{folderName}</span> : null}
          </div>

          {bookmark.tags.length > 0 ? (
            <div className="frame-tags">
              {bookmark.tags.slice(0, 4).map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <button
          className="grease-btn"
          onClick={onToggle}
          aria-pressed={bookmark.starred}
          aria-label={bookmark.starred ? "Remove the grease pencil mark" : "Mark with grease pencil"}
          title={bookmark.starred ? "Remove mark" : "Mark this one"}
        >
          <GreaseCircle marked={bookmark.starred} />
        </button>
      </div>
    </div>
  )
}

/**
 * A circle scrawled on the print with a red grease pencil. Deliberately not a
 * clean ellipse: it wobbles, it overshoots where the hand came back round.
 */
function GreaseCircle({ marked }: { marked: boolean }) {
  if (!marked) {
    return (
      <svg viewBox="0 0 30 30" aria-hidden>
        <circle className="grease-empty" cx="15" cy="15" r="10" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 30 30" aria-hidden>
      <path
        className="grease-mark"
        d="M20.8 5.9c4.4 1.6 6.4 6.7 4.6 11.1c-1.9 4.6-7.4 7.3-12.2 6.1C8.2 21.9 5 17.2 5.7 12.4C6.4 7.8 10.8 4.4 15.6 4.6c3.4.1 6.7 1.7 8.5 4.3c.5.8.9 1.6 1.1 2.5"
      />
      <path
        className="grease-mark-2"
        d="M22.4 8.2c2.3 3.1 2 7.9-.8 10.6c-3 2.9-8.3 3.4-11.9 1.1"
      />
    </svg>
  )
}
