/**
 * Tests for the reading store — remembering the user's current passage.
 *
 * Run with:  npx vitest run src/stores/__tests__/reading.test.js
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useReadingStore, DEFAULT_PASSAGE } from '../reading'

describe('reading store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('starts on the default passage before anything has been read', () => {
    const reading = useReadingStore()
    expect(reading.lastPassagePath).toBe('/read/PRO/19')
  })

  it('remembers the passage the reader last showed', () => {
    const reading = useReadingStore()
    reading.setLastPassage('JHN', 3)

    expect(reading.book).toBe('JHN')
    expect(reading.chapter).toBe(3)
    expect(reading.lastPassagePath).toBe('/read/JHN/3')
  })

  it('normalises a lowercase or padded book abbreviation', () => {
    const reading = useReadingStore()
    reading.setLastPassage('  rom ', '8')
    expect(reading.lastPassagePath).toBe('/read/ROM/8')
  })

  it('accepts numbered books like 1CO and 3JN', () => {
    const reading = useReadingStore()
    reading.setLastPassage('1CO', 13)
    expect(reading.lastPassagePath).toBe('/read/1CO/13')

    reading.setLastPassage('3JN', 1)
    expect(reading.lastPassagePath).toBe('/read/3JN/1')
  })

  it('ignores junk rather than storing an unroutable passage', () => {
    const reading = useReadingStore()
    reading.setLastPassage('JHN', 3)

    for (const [book, chapter] of [
      ['', 3], [null, 3], ['TOOLONG', 3], ['J', 3],
      ['JHN', 0], ['JHN', -1], ['JHN', 1.5], ['JHN', 999], ['JHN', 'abc'], ['JHN', null],
    ]) {
      reading.setLastPassage(book, chapter)
    }

    expect(reading.lastPassagePath).toBe('/read/JHN/3')
  })

  it('falls back to the default when persisted state is corrupt', () => {
    const reading = useReadingStore()
    // Simulates a bad localStorage payload rehydrated by pinia-persist
    reading.$patch({ book: 'not-a-book', chapter: 4000 })

    expect(reading.lastPassagePath).toBe(
      `/read/${DEFAULT_PASSAGE.book}/${DEFAULT_PASSAGE.chapter}`
    )
  })

  it('reset returns to the default passage', () => {
    const reading = useReadingStore()
    reading.setLastPassage('REV', 22)
    reading.reset()
    expect(reading.lastPassagePath).toBe('/read/PRO/19')
  })
})
