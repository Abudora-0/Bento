/**
 * The popup calls these routes from a chrome-extension:// origin, a different
 * origin than the site itself, so without these headers the browser blocks
 * the response before the extension's JavaScript ever sees it, even though
 * the request itself succeeded on the wire.
 *
 * The bearer token in lib/auth.ts is the actual access control. Reflecting
 * whatever Origin sent the request does not weaken that, CORS only decides
 * whether a browser hands a response to page script, it is not a substitute
 * for authentication and nothing here carries cookies for it to protect.
 */
export function corsHeaders(request: Request): HeadersInit {
  return {
    "access-control-allow-origin": request.headers.get("origin") ?? "*",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
    vary: "origin"
  }
}

/** Answers the browser's preflight before it will send the real request. */
export function corsPreflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) })
}

/** Response.json, with the CORS headers merged in. */
export function corsJson(request: Request, body: unknown, init: ResponseInit = {}): Response {
  return Response.json(body, { ...init, headers: { ...corsHeaders(request), ...init.headers } })
}
