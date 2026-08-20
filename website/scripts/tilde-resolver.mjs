/**
 * Node module resolution hook for the test run. Two jobs, both filling in for
 * inference that webpack and tsc do and Node's own ESM resolver does not.
 * See test-loader.mjs for why this exists at all.
 */
import { pathToFileURL } from "node:url"
import { resolve as resolvePath, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = pathToFileURL(`${resolvePath(dirname(fileURLToPath(import.meta.url)), "..")}/`)

/** Tries each candidate in turn, returning the first that resolves. */
async function firstThatResolves(candidates, context, nextResolve) {
  let lastError

  for (const candidate of candidates) {
    try {
      return await nextResolve(candidate, context)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError
}

export async function resolve(specifier, context, nextResolve) {
  // 1. The "~/" alias from tsconfig paths. These never carry an extension,
  //    so .ts comes first, then .tsx, then the bare form.
  if (specifier.startsWith("~/")) {
    const rewritten = new URL(specifier.slice(2), ROOT).href
    return firstThatResolves(
      [`${rewritten}.ts`, `${rewritten}.tsx`, rewritten],
      context,
      nextResolve
    )
  }

  try {
    return await nextResolve(specifier, context)
  } catch (error) {
    /*
     * 2. Extensionless subpaths of a package with no "exports" map. Next is
     *    one: "next/server" falls through to plain path resolution, which
     *    lands on a directory entry with no extension and gives up. Bundlers
     *    add the .js themselves. Only bare package specifiers get this, so a
     *    genuinely missing relative import still fails loudly.
     */
    const bare = !specifier.startsWith(".") && !specifier.startsWith("/") && !specifier.includes("://")
    const extensionless = !/\.[a-z]+$/i.test(specifier)

    if (bare && extensionless && specifier.includes("/")) {
      return firstThatResolves([`${specifier}.js`, `${specifier}/index.js`], context, nextResolve)
    }

    throw error
  }
}
