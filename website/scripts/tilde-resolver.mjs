/**
 * Node module resolution hook. Rewrites a "~/..." specifier to a file url
 * rooted at the website directory, the same mapping tsconfig.json's "paths"
 * gives webpack and tsc. See test-loader.mjs for why this exists.
 */
import { pathToFileURL } from "node:url"
import { resolve as resolvePath, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = pathToFileURL(`${resolvePath(dirname(fileURLToPath(import.meta.url)), "..")}/`)

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith("~/")) return nextResolve(specifier, context)

  const rewritten = new URL(specifier.slice(2), ROOT).href

  // "~/" imports never carry an extension, webpack and tsc infer it. Node
  // does not, so try .ts first, since every file this alias points at in
  // practice is one, then .tsx, then the bare specifier as a last resort.
  for (const candidate of [`${rewritten}.ts`, `${rewritten}.tsx`, rewritten]) {
    try {
      return await nextResolve(candidate, context)
    } catch {
      // try the next candidate
    }
  }

  return nextResolve(rewritten, context)
}
