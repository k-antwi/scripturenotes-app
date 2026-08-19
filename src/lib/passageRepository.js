import { db } from './db'
import { PassageAPI } from './api'
import { MOCK_PASSAGE, MOCK_NOTES } from './mockPassage'

/**
 * Cache-first scripture loading (PRD §4.1 steps 2–3b, §9 Performance:
 * "must render within 200ms from cache").
 */
export const PassageRepository = {
  async get(book, chapter, translation) {
    const cached = await db.passages.get({ book, chapter, translation })
    if (cached) {
      // Return immediately; refresh quietly in the background so stale
      // cached copies (e.g. corrected footnotes) eventually catch up.
      this._refreshInBackground(book, chapter, translation)
      return cached.content
    }

    try {
      const { data } = await PassageAPI.get(book, chapter, translation)
      await db.passages.put({
        book,
        chapter,
        translation,
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

  async getNotes(book, chapter, translation) {
    const cached = await db.studyNotes.get({ book, chapter, translation })
    if (cached) return cached.content

    try {
      const { data } = await PassageAPI.notes(book, chapter, translation)
      await db.studyNotes.put({ book, chapter, translation, content: data })
      return data
    } catch (err) {
      if (book === MOCK_NOTES.book && Number(chapter) === MOCK_NOTES.chapter) return MOCK_NOTES
      throw err
    }
  },

  /** Pre-cache an entire book for the 'Download for Offline' action (PRD §5.4). */
  async downloadBook(book, chapterCount, translation, onProgress) {
    for (let chapter = 1; chapter <= chapterCount; chapter++) {
      await this.get(book, chapter, translation)
      onProgress?.(chapter / chapterCount)
    }
  },

  async _refreshInBackground(book, chapter, translation) {
    try {
      const { data } = await PassageAPI.get(book, chapter, translation)
      await db.passages.put({
        book,
        chapter,
        translation,
        fetchedAt: new Date().toISOString(),
        content: data
      })
    } catch {
      // Offline or API miss — the cached copy already served the user.
    }
  }
}

export default PassageRepository
