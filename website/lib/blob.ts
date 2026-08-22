import { del, put } from "@vercel/blob"

/**
 * Screenshots.
 *
 * These used to be jpg files next to the database, served back through an
 * unauthenticated route keyed on an unguessable uuid. Blob storage keeps that
 * exact model: the url it hands back carries a random suffix, so it is
 * unguessable in the same way and readable without a token, which is what both
 * the site's own img tags and the extension's need.
 *
 * The route that used to serve them is gone. Blob serves its own urls, so
 * proxying every image through a serverless function would just add latency
 * and burn invocations for nothing.
 */

const MAX_BYTES = 3 * 1024 * 1024

export type SaveResult = { ok: true; url: string } | { ok: false; error: string }

export async function saveScreenshot(file: File): Promise<SaveResult> {
  if (file.size > MAX_BYTES) return { ok: false, error: "Screenshot is too large." }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    // Local work without a blob store attached. The capture still succeeds,
    // it just arrives without a picture, which the frame already handles.
    return { ok: false, error: "No blob store configured." }
  }

  try {
    const { url } = await put(`screenshots/${crypto.randomUUID()}.jpg`, file, {
      access: "public",
      contentType: "image/jpeg",
      // Blob appends a random suffix by default, which is what makes the url
      // unguessable. Keeping it is the whole security model here.
      addRandomSuffix: true,
      cacheControlMaxAge: 31_536_000
    })

    return { ok: true, url }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Upload failed." }
  }
}

/**
 * Removes a screenshot, given the url stored on the bookmark.
 *
 * Called when a bookmark is deleted and when a recapture replaces the picture
 * it had. Missing or already gone is not an error, there is nothing left to
 * clean up either way.
 */
export async function deleteScreenshot(url: string | null): Promise<void> {
  if (!url || !process.env.BLOB_READ_WRITE_TOKEN) return

  // Only ever delete our own blobs. A url from anywhere else, however it got
  // into the row, is not ours to touch.
  if (!url.includes(".blob.vercel-storage.com/")) return

  try {
    await del(url)
  } catch {
    // Already deleted, or the store is unreachable. Neither is worth failing
    // the surrounding action over, the row is already gone.
  }
}
