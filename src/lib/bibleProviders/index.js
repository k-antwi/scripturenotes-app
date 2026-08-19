import { laravelProvider } from './laravelProvider'
import { freeUseBibleProvider } from './freeUseBibleProvider'

/** Backend identifiers — also used as Dexie cache-key discriminants. */
export const BIBLE_SOURCES = {
  LARAVEL: 'laravel',
  FREEUSE: 'freeuse'
}

const providers = {
  [BIBLE_SOURCES.LARAVEL]: laravelProvider,
  [BIBLE_SOURCES.FREEUSE]: freeUseBibleProvider
}

/** Resolve a bible source id to its provider, falling back to Laravel. */
export function getBibleProvider(source) {
  return providers[source] ?? laravelProvider
}

export function isValidBibleSource(source) {
  return Object.prototype.hasOwnProperty.call(providers, source)
}

/**
 * Which Bible backend the app talks to — deploy-time configuration only
 * (VITE_DEFAULT_BIBLE_SOURCE), not a user-facing setting. Switching between
 * the Laravel Bible service and the Free Use Bible API (bible.helloao.org)
 * is an ops/build decision, so there is deliberately no UI to change this
 * at runtime.
 */
export const ACTIVE_BIBLE_SOURCE = isValidBibleSource(import.meta.env.VITE_DEFAULT_BIBLE_SOURCE)
  ? import.meta.env.VITE_DEFAULT_BIBLE_SOURCE
  : BIBLE_SOURCES.LARAVEL

/** Resolve the configured provider directly — the common case for callers. */
export function getActiveBibleProvider() {
  return getBibleProvider(ACTIVE_BIBLE_SOURCE)
}

export { laravelProvider, freeUseBibleProvider }
