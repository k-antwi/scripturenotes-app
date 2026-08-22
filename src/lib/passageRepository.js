import { db } from './db'
import { MOCK_PASSAGE, MOCK_NOTES } from './mockPassage'
import { BIBLE_SOURCES, getActiveBibleProvider, getBibleProvider } from './bibleProviders'
import { useAuthStore } from '@/stores/auth'

/**
 * Cache-first scripture loading (PRD §4.1 steps 2–3b, §9 Performance:
 * "must render within 200ms from cache").
 *
 * Provider selection is now auth-aware at call-time:
 *  - Authenticated  → laravelProvider  (full backend gateway: NIV, ESV, audio…)
 *  - Unauthenticated → freeUseBibleProvider (direct to bible.helloao.org, KJV / public domain)
 *
 * Callers no longer need to pass `source` — it is resolved automatically.
 * The optional `source` parameter is kept for explicit overrides (e.g. the
 * SettingsView letting a user pin a specific provider) and for tests.
 */
export const PassageRepository = {
  async get(book, chapter, translation, source = null) {
    const resolvedSource = source ?? this._resolveSource()
    const cacheKey = { book, chapter, translation, source: resolvedSource }

    const cached = await db.passageCache.get(cacheKey)
    if (cached) {
      // Return immediately; refresh quietly in the background so stale
      // cached copies (e.g. corrected footnotes) eventually catch up.
      this._refreshInBackground(book, chapter, translation, resolvedSource)
      return cached.content
    }

    try {
      const provider = getBibleProvider(resolvedSource)
      const data = await provider.getPassage(book, chapter, translation)
      await db.passageCache.put({
        book,
        chapter,
        translation,
        source: resolvedSource,
        fetchedAt: new Date().toISOString(),
        content: data
      })
      return data
    } catch (err) {
      // No backend configured yet / offline with nothing cached — fall back
      // to the bundled fixture so the reader still has something to show.
      if (book === MOCK_PASSAGE.book && Number(chapter) === MOCK_PASSAGE.chapter) {
        return MOCK_PASSAGE
      }
      throw err
    }
  },

  async getNotes(book, chapter, translation, source = null) {
    const resolvedSource = source ?? this._resolveSource()
    const cached = await db.studyNoteCache.get({ book, chapter, translation, source: resolvedSource })
    if (cached) return cached.content

    try {
      const provider = getBibleProvider(resolvedSource)
      const data = await provider.getNotes(book, chapter, translation)
      // Some providers don't offer study notes and return null intentionally
      // — don't cache an empty result; let the caller's fallback handle it.
      if (data == null) {
        if (book === MOCK_NOTES.book && Number(chapter) === MOCK_NOTES.chapter) return MOCK_NOTES
        return null
      }
      await db.studyNoteCache.put({ book, chapter, translation, source: resolvedSource, content: data })
      return data
    } catch (err) {
      if (book === MOCK_NOTES.book && Number(chapter) === MOCK_NOTES.chapter) return MOCK_NOTES
      throw err
    }
  },

  /** Pre-cache an entire book for the 'Download for Offline' action (PRD §5.4). */
  async downloadBook(book, chapterCount, translation, source, onProgress) {
    // Support the pre-existing 4-arg call signature (source omitted).
    if (typeof source === 'function') {
      onProgress = source
      source = null
    }
    const resolvedSource = source ?? this._resolveSource()

    for (let chapter = 1; chapter <= chapterCount; chapter++) {
      await this.get(book, chapter, translation, resolvedSource)
      onProgress?.(chapter / chapterCount)
    }
  },

  /**
   * Resolve which source to use based on current auth state.
   * Called lazily (not at import time) so Pinia is always ready.
   */
  _resolveSource() {
    try {
      const authStore = useAuthStore()
      return authStore.isAuthenticated ? BIBLE_SOURCES.LARAVEL : BIBLE_SOURCES.FREEUSE
    } catch {
      // Pinia not yet mounted (e.g. unit test without a full app) — default to freeuse.
      return BIBLE_SOURCES.FREEUSE
    }
  },

  async _refreshInBackground(book, chapter, translation, source) {
    try {
      const provider = getBibleProvider(source)
      const data = await provider.getPassage(book, chapter, translation)
      await db.passageCache.put({
        book,
        chapter,
        translation,
        source,
        fetchedAt: new Date().toISOString(),
        content: data
      })
    } catch {
      // Offline or API miss — the cached copy already served the user.
    }
  }
}

export default PassageRepository
