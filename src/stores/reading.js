import { defineStore } from 'pinia'

/**
 * Remembers where the user was last reading (PRD §5.1.1).
 *
 * The Read tab and the app's root redirect both used to point at a hardcoded
 * /read/PRO/19, so switching to Notes and back threw away whatever chapter
 * the user had open. Both now resolve through this store, which persists to
 * localStorage so the passage also survives an app restart.
 */
export const DEFAULT_PASSAGE = Object.freeze({ book: 'PRO', chapter: 19 })

// Canonical 3-character book abbreviations: PRO, JHN, 1CO, 2TH, 3JN …
const BOOK_PATTERN = /^[1-3A-Z][A-Z]{2}$/
const MAX_CHAPTER = 150 // Psalms, the longest book

function isValidPassage(book, chapter) {
  return (
    typeof book === 'string' &&
    BOOK_PATTERN.test(book) &&
    Number.isInteger(chapter) &&
    chapter >= 1 &&
    chapter <= MAX_CHAPTER
  )
}

export function passagePath(book, chapter) {
  return `/read/${book}/${chapter}`
}

export const useReadingStore = defineStore('reading', {
  state: () => ({
    book: DEFAULT_PASSAGE.book,
    chapter: DEFAULT_PASSAGE.chapter,
  }),

  getters: {
    /**
     * Route path for the last passage read. Falls back to the default when
     * the persisted value is missing or corrupt, so a bad localStorage entry
     * can never strand the user on an unroutable URL.
     */
    lastPassagePath: (state) =>
      isValidPassage(state.book, state.chapter)
        ? passagePath(state.book, state.chapter)
        : passagePath(DEFAULT_PASSAGE.book, DEFAULT_PASSAGE.chapter),
  },

  actions: {
    /** Records the passage the reader is currently showing. Ignores junk. */
    setLastPassage(book, chapter) {
      const nextBook = typeof book === 'string' ? book.trim().toUpperCase() : book
      const nextChapter = Number(chapter)
      if (!isValidPassage(nextBook, nextChapter)) return
      this.book = nextBook
      this.chapter = nextChapter
    },

    reset() {
      this.book = DEFAULT_PASSAGE.book
      this.chapter = DEFAULT_PASSAGE.chapter
    },
  },

  persist: true,
})
