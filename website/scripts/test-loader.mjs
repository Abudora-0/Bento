/**
 * Preloaded via node --import, see the "test" script in package.json.
 * Registers the "~/" resolver so node --test can load route and lib files
 * without rewriting their imports away from the alias webpack and tsc use.
 */
import { register } from "node:module"

register("./tilde-resolver.mjs", import.meta.url)
