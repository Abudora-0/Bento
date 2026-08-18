// Latin only. The full entrypoints drag in cyrillic and vietnamese subsets,
// which triples the size of a popup nobody waits around for.
import "@fontsource/ibm-plex-mono/latin-400.css"
import "@fontsource/ibm-plex-mono/latin-500.css"
import "@fontsource/oswald/latin-400.css"
import "@fontsource/oswald/latin-500.css"
import "@fontsource/oswald/latin-600.css"
import "./popup.css"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  captureCount,
  getActiveTab,
  grabScreenshot,
  hostnameOf,
  parseTags,
  recentCaptures,
  saveCapture,
  setStarred,
  type ActiveTab
} from "./lib/capture"
import { supabase } from "./lib/supabase"
import type { Bookmark } from "./lib/types"

const SITE_URL = (process.env.PLASMO_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")

export default function Popup() {
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSignedIn(Boolean(data.session))
      setReady(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session))
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return (
    <div className="sheet">
      <Leader />
      {!ready ? <div className="empty">Loading the roll</div> : signedIn ? <Darkroom /> : <SignIn />}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Leader                                                                      */
/* -------------------------------------------------------------------------- */

function Leader() {
  return (
    <>
      <div className="leader">
        <div className="leader-mark">
          <span className="leader-name">Bento</span>
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
/* Sign in                                                                     */
/* -------------------------------------------------------------------------- */

function SignIn() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)

    const call =
      mode === "signup"
        ? supabase.auth.signUp({ email, password })
        : supabase.auth.signInWithPassword({ email, password })

    const { data, error: authError } = await call

    if (authError) setError(authError.message)
    else if (mode === "signup" && !data.session) {
      setNotice("Check your inbox to confirm the address, then sign in.")
      setMode("signin")
    }

    setBusy(false)
  }

  return (
    <div className="pad">
      <h1 className="head-2">Load the film</h1>
      <p className="lede">
        Sign in with the same account you use on the Bento site. Captures land in the same tray.
      </p>

      <form onSubmit={submit} className="stack" style={{ marginTop: 14 }}>
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="field"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className="field"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error ? <div className="notice">{error}</div> : null}
        {notice ? <div className="notice notice-ok">{notice}</div> : null}

        <button className="shutter" type="submit" disabled={busy}>
          {busy ? "Working" : mode === "signup" ? "Create account" : "Sign in"}
        </button>

        <button
          type="button"
          className="ghost"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup")
            setError(null)
            setNotice(null)
          }}
        >
          {mode === "signup" ? "I already have an account" : "Create an account"}
        </button>
      </form>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Darkroom, the signed in popup                                               */
/* -------------------------------------------------------------------------- */

function Darkroom() {
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

  const previewRef = useRef<string | null>(null)

  const refreshStrip = useCallback(async () => {
    const [rows, count] = await Promise.all([recentCaptures(12), captureCount()])
    setRecent(rows)
    setTotal(count)
  }, [])

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

      await refreshStrip()
    })()

    return () => {
      active = false
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    }
  }, [refreshStrip])

  async function expose() {
    if (!tab) return

    setSaving(true)
    setError(null)
    setSaved(null)

    const result = await saveCapture({
      url: tab.url,
      title: tab.title,
      faviconUrl: tab.faviconUrl,
      tags: parseTags(tags),
      notes,
      screenshot: shot
    })

    if (result.ok) {
      setSaved(result.updated ? "Frame updated on the sheet." : "Frame exposed.")
      setTags("")
      setNotes("")
      await refreshStrip()
    } else {
      setError(result.error)
    }

    setSaving(false)
  }

  async function toggleGrease(bookmark: Bookmark) {
    const next = !bookmark.starred

    setRecent((rows) => rows.map((r) => (r.id === bookmark.id ? { ...r, starred: next } : r)))

    const ok = await setStarred(bookmark.id, next)
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
              onToggle={() => toggleGrease(bookmark)}
            />
          ))
        )}
      </div>

      <div className="footer">
        <a href={`${SITE_URL}/app`} target="_blank" rel="noreferrer">
          Open the tray
        </a>
        <button
          className="ghost"
          onClick={() => {
            void supabase.auth.signOut()
          }}
        >
          Sign out
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
  onToggle
}: {
  bookmark: Bookmark
  number: number
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
          <div className="strip-meta">{host}</div>

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
