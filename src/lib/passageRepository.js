import { db } from './db'
import { MOCK_PASSAGE, MOCK_NOTES } from './mockPassage'
import { ACTIVE_BIBLE_SOURCE, getBibleProvider } from './bibleProviders'

/**
 * Cache-first scripture loading (PRD §4.1 steps 2–3b, §9 Performance:
 * "must render within 200ms from cache").
 *
 * `source` selects which backend serves the passage — the Laravel Bible
 * service or the Free Use Bible API fetched directly from the frontend
 * (see src/lib/bibleProviders). It defaults to ACTIVE_BIBLE_SOURCE, which
 * is fixed at build/deploy time via VITE_DEFAULT_BIBLE_SOURCE — this is
 * not something the user switches at runtime.
 */
export const PassageRepository = {
  async get(book, chapter, translation, source = ACTIVE_BIBLE_SOURCE) {
    const cached = await db.passages.get({ book, chapter, translation, source })
    if (cached) {
      // Return immediately; refresh quietly in the background so stale
      // cached copies (e.g. corrected footnotes) eventually catch up.
      this._refreshInBackground(book, chapter, translation, source)
      return cached.content
    }

    try {
      const data = await getBibleProvider(source).getPassage(book, chapter, translation)
      await db.passages.put({
        book,
        chapter,
        translation,
        source,
        fetchedAt: new Date().toISOString(),
        content: data
      })
      return data
    } catch (err) {
      // No backend configured yet / offline with nothing cached — fall back
      // to the bundled fixture so the reader still has something to show.
      if (book === MOCK_PASSAGE.book && Number(chapter) === MOCK_PASSAGE.chapter) return MOCK_PASSAGE
      throw err
    }
  },

  async getNotes(book, chapter, translation, source = ACTIVE_BIBLE_SOURCE) {
    const cached = await db.studyNotes.get({ book, chapter, translation, source })
    if (cached) return cached.content

    try {
      const data = await getBibleProvider(source).getNotes(book, chapter, translation)
      // Some providers (e.g. Free Use Bible API) don't offer study notes and
      // return null intentionally — don't cache an empty result as if it
      // came from the network, just let the caller's fallback handle it.
      if (data == null) {
        if (book === MOCK_NOTES.book && Number(chapter) === MOCK_NOTES.chapter) return MOCK_NOTES
        return null
      }
      await db.studyNotes.put({ book, chapter, translation, source, content: data })
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
      source = ACTIVE_BIBLE_SOURCE
    }
    source = source ?? ACTIVE_BIBLE_SOURCE

    for (let chapter = 1; chapter <= chapterCount; chapter++) {
      await this.get(book, chapter, translation, source)
      onProgress?.(chapter / chapterCount)
    }
  },

  async _refreshInBackground(book, chapter, translation, source) {
    try {
      const data = await getBibleProvider(source).getPassage(book, chapter, translation)
      await db.passages.put({
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
