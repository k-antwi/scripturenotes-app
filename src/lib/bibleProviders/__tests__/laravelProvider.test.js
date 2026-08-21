import { describe, it, expect, vi, beforeEach } from 'vitest'
import { laravelProvider } from '../laravelProvider'
import { BibleAPI } from '@/lib/api'

vi.mock('@/lib/api', () => ({
  BibleAPI: {
    chapter:    vi.fn(),
    passage:    vi.fn(),
    search:     vi.fn(),
    audio:      vi.fn(),
    verseOfDay: vi.fn(),
    dictionary: vi.fn(),
    versions:   vi.fn()
  }
}))

/** Helper — wrap data in the backend envelope shape */
const envelope = (data, provider = 'api_bible', cached = false) => ({
  data: { data, meta: { provider, cached } }
})

const johnThreeVerses = [
  { book: 'JHN', chapter: 3, verse: 16, verseId: 43003016, text: 'For God so loved the world…' }
]

beforeEach(() => vi.clearAllMocks())

// ─── getPassage (calls BibleAPI.chapter) ─────────────────────────────────────

describe('laravelProvider.getPassage', () => {
  it('calls /api/bible/chapter with correct params', async () => {
    BibleAPI.chapter.mockResolvedValue(
      envelope({ reference: 'JHN 3', version: 'NIV', verses: johnThreeVerses })
    )

    await laravelProvider.getPassage('JHN', 3, 'NIV')

    expect(BibleAPI.chapter).toHaveBeenCalledWith('JHN', 3, 'NIV')
  })

  it('unwraps the envelope so callers get reference/version/verses directly', async () => {
    BibleAPI.chapter.mockResolvedValue(
      envelope({ reference: 'JHN 3', version: 'KJV', verses: johnThreeVerses })
    )

    const result = await laravelProvider.getPassage('JHN', 3, 'KJV')

    expect(result.reference).toBe('JHN 3')
    expect(result.version).toBe('KJV')
    expect(result.verses).toEqual(johnThreeVerses)
  })

  it('attaches meta from the envelope alongside the passage data', async () => {
    BibleAPI.chapter.mockResolvedValue(
      envelope({ reference: 'ROM 8', version: 'ESV', verses: [] }, 'free_use', true)
    )

    const result = await laravelProvider.getPassage('ROM', 8, 'ESV')

    expect(result.meta).toEqual({ provider: 'free_use', cached: true })
  })
})

// ─── getNotes ────────────────────────────────────────────────────────────────

describe('laravelProvider.getNotes', () => {
  it('returns null (notes not yet served by the gateway)', async () => {
    const result = await laravelProvider.getNotes('JHN', 3, 'NIV')
    expect(result).toBeNull()
  })
})

// ─── search ──────────────────────────────────────────────────────────────────

describe('laravelProvider.search', () => {
  it('calls /api/bible/search with correct params', async () => {
    BibleAPI.search.mockResolvedValue(
      envelope({ reference: 'Search results — KJV', version: 'KJV', verses: [] })
    )

    await laravelProvider.search('faith hope love', 'KJV', 'keyword')

    expect(BibleAPI.search).toHaveBeenCalledWith('faith hope love', 'KJV', 'keyword')
  })

  it('defaults to keyword search type', async () => {
    BibleAPI.search.mockResolvedValue(
      envelope({ reference: 'Search results — ESV', version: 'ESV', verses: [] })
    )

    await laravelProvider.search('grace', 'ESV')

    expect(BibleAPI.search).toHaveBeenCalledWith('grace', 'ESV', 'keyword')
  })

  it('unwraps the envelope for search results', async () => {
    const verses = [{ book: 'ROM', chapter: 5, verse: 1, verseId: 45005001, text: 'Therefore…' }]
    BibleAPI.search.mockResolvedValue(
      envelope({ reference: 'Search — NIV', version: 'NIV', verses })
    )

    const result = await laravelProvider.search('justified', 'NIV')

    expect(result.verses).toEqual(verses)
  })
})

// ─── getVerseOfDay ────────────────────────────────────────────────────────────

describe('laravelProvider.getVerseOfDay', () => {
  it('calls /api/bible/verse-of-day and unwraps envelope', async () => {
    BibleAPI.verseOfDay.mockResolvedValue(
      envelope({ reference: 'Psalm 23:1', version: 'NIV', verses: [] }, 'youversion')
    )

    const result = await laravelProvider.getVerseOfDay()

    expect(BibleAPI.verseOfDay).toHaveBeenCalled()
    expect(result.reference).toBe('Psalm 23:1')
    expect(result.meta.provider).toBe('youversion')
  })
})

// ─── getDictionary ────────────────────────────────────────────────────────────

describe('laravelProvider.getDictionary', () => {
  it('calls /api/bible/dictionary and returns definition data', async () => {
    BibleAPI.dictionary.mockResolvedValue({
      data: { data: { word: 'grace', definition: ['unmerited favour'] }, meta: { provider: 'bolls' } }
    })

    const result = await laravelProvider.getDictionary('grace')

    expect(BibleAPI.dictionary).toHaveBeenCalledWith('grace')
    expect(result.word).toBe('grace')
  })
})

// ─── getAvailableTranslations ─────────────────────────────────────────────────

describe('laravelProvider.getAvailableTranslations', () => {
  it('calls /api/bible/versions with language param', async () => {
    const versions = [{ id: 'KJV', name: 'King James Version', abbreviation: 'KJV', language: 'eng' }]
    BibleAPI.versions.mockResolvedValue({ data: { data: versions, meta: { provider: 'combined' } } })

    const result = await laravelProvider.getAvailableTranslations('en')

    expect(BibleAPI.versions).toHaveBeenCalledWith('en')
    expect(result).toEqual(versions)
  })

  it('defaults to English when no language param given', async () => {
    BibleAPI.versions.mockResolvedValue({ data: { data: [], meta: {} } })

    await laravelProvider.getAvailableTranslations()

    expect(BibleAPI.versions).toHaveBeenCalledWith('en')
  })
})
