import { HelloAoBibleClient } from './helloaoClient'
import { normalizeHelloaoChapter } from './normalizeHelloao'

/**
 * Alternative provider — talks directly to the Free Use Bible API
 * (bible.helloao.org) from the frontend instead of round-tripping through
 * the Laravel backend. Useful when the backend Bible service is
 * unavailable, slow, or simply not needed for public-domain translations
 * (PRD §11.5).
 *
 * See: https://bible.helloao.org/docs/sdks/javascript.html
 */
const client = new HelloAoBibleClient()

export const freeUseBibleProvider = {
  id: 'freeuse',
  label: 'Free Use Bible API',

  async getPassage(book, chapter, translation) {
    const raw = await client.getTranslationBookChapter(translation, book, chapter)
    return normalizeHelloaoChapter(raw, { book, chapter, translation })
  },

  // The Free Use Bible API doesn't publish study notes (only scripture text
  // and commentaries in a different shape) — return null so the caller's
  // "notes are supplementary" fallback kicks in without a wasted network call.
  async getNotes() {
    return null
  },

  getAvailableTranslations() {
    return client.getAvailableTranslations()
  },

  getBooks(translation) {
    return client.getTranslationBooks(translation)
  }
}

export default freeUseBibleProvider
