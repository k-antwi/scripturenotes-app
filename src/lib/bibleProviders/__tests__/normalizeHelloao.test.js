import { describe, it, expect } from 'vitest'
import { normalizeHelloaoChapter } from '../normalizeHelloao'

// Shape mirrors a real response from GET /api/BSB/PRO/19.json
const RAW_CHAPTER = {
  translation: { id: 'BSB' },
  book: { id: 'PRO', name: 'Proverbs' },
  chapter: {
    number: 19,
    content: [
      { type: 'heading', content: ['The Man of Integrity'] },
      {
        type: 'verse',
        number: 1,
        content: [
          { text: 'Better a poor man who walks with integrity', poem: 1 },
          { text: 'than a fool whose lips are perverse.', poem: 2 }
        ]
      },
      { type: 'line_break' },
      {
        type: 'verse',
        number: 11,
        content: [
          { text: "A man's discretion gives him patience,", poem: 1 },
          { text: 'and his glory is to overlook an offense.', poem: 2, noteId: 1 }
        ]
      }
    ],
    footnotes: [
      { noteId: 1, caller: 'a', text: "Or: A man's wisdom makes him slow to anger." }
    ]
  },
  thisChapterReference: { book: 'Proverbs', chapter: 19 },
  numberOfVerses: 2
}

describe('normalizeHelloaoChapter', () => {
  it('extracts only verse entries, skipping headings and line breaks', () => {
    const result = normalizeHelloaoChapter(RAW_CHAPTER, { book: 'PRO', chapter: 19, translation: 'BSB' })
    expect(result.verses).toHaveLength(2)
    expect(result.verses.map((v) => v.number)).toEqual([1, 11])
  })

  it('joins multi-part verse content into a single trimmed text string', () => {
    const result = normalizeHelloaoChapter(RAW_CHAPTER, { book: 'PRO', chapter: 19, translation: 'BSB' })
    expect(result.verses[0].text).toBe('Better a poor man who walks with integrity than a fool whose lips are perverse.')
  })

  it('attaches footnotes referenced by noteId, using the caller as marker', () => {
    const result = normalizeHelloaoChapter(RAW_CHAPTER, { book: 'PRO', chapter: 19, translation: 'BSB' })
    expect(result.verses[1].footnotes).toEqual([
      { marker: 'a', text: "Or: A man's wisdom makes him slow to anger." }
    ])
  })

  it('omits the footnotes key entirely for verses without one', () => {
    const result = normalizeHelloaoChapter(RAW_CHAPTER, { book: 'PRO', chapter: 19, translation: 'BSB' })
    expect(result.verses[0]).not.toHaveProperty('footnotes')
  })

  it('builds book/chapter/translation and a human-readable reference', () => {
    const result = normalizeHelloaoChapter(RAW_CHAPTER, { book: 'PRO', chapter: 19, translation: 'BSB' })
    expect(result.book).toBe('PRO')
    expect(result.chapter).toBe(19)
    expect(result.translation).toBe('BSB')
    expect(result.reference).toBe('Proverbs 19')
  })

  it('falls back to "{book} {chapter}" when no chapter reference is present', () => {
    const raw = { ...RAW_CHAPTER, thisChapterReference: undefined }
    const result = normalizeHelloaoChapter(raw, { book: 'PRO', chapter: 19, translation: 'BSB' })
    expect(result.reference).toBe('PRO 19')
  })
})
