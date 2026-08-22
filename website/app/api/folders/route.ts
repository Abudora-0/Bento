import { hasValidBearer, unauthorized } from "~/lib/auth"
import { corsJson, corsPreflight } from "~/lib/cors"
import { listFolders } from "~/lib/db/folders"

export const runtime = "nodejs"

export function OPTIONS(request: Request) {
  return corsPreflight(request)
}

/** Feeds the popup's folder picker. The extension only reads folders, it does not manage them. */
export async function GET(request: Request) {
  if (!(await hasValidBearer(request))) return unauthorized(request)

  return corsJson(request, { folders: await listFolders() })
}
