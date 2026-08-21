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

/** Resolve a bible source id to its provider, falling back to freeuse. */
export function getBibleProvider(source) {
  return providers[source] ?? freeUseBibleProvider
}

export function isValidBibleSource(source) {
  return Object.prototype.hasOwnProperty.call(providers, source)
}

/**
 * Resolve the active Bible provider based on authentication state at call-time.
 *
 * Routing rules:
 *  - Authenticated  → laravelProvider (full multi-provider backend gateway)
 *    The backend gateway serves licensed translations (NIV, ESV…) via API.Bible,
 *    public-domain translations (KJV, ASV…) via Free Use, audio via Bible Brain,
 *    and semantic search via Bolls — all behind a single set of endpoints.
 *
 *  - Unauthenticated → freeUseBibleProvider (direct calls to bible.helloao.org)
 *    Public-domain translations only. No API key. No account required.
 *    Annotations created offline still write to Dexie and sync on next login.
 *
 * This is evaluated at call-time so a login/logout mid-session takes effect
 * on the next passage load without a page reload.
 *
 * @param {import('pinia').Store|null} authStore — pass useAuthStore() from the
 *   caller. Kept as a parameter (rather than imported here) so tests can inject
 *   a stub without mocking the Pinia store.
 */
export function getActiveBibleProvider(authStore) {
  if (authStore?.isAuthenticated) {
    return laravelProvider
  }
  return freeUseBibleProvider
}

export { laravelProvider, freeUseBibleProvider }
