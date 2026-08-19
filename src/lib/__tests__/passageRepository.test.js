import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPassagesGet = vi.fn()
const mockPassagesPut = vi.fn()
const mockNotesGet = vi.fn()
const mockNotesPut = vi.fn()

vi.mock('../db', () => ({
  db: {
    passages: { get: mockPassagesGet, put: mockPassagesPut },
    studyNotes: { get: mockNotesGet, put: mockNotesPut }
  }
}))

const mockGetPassage = vi.fn()
const mockGetNotes = vi.fn()

vi.mock('../bibleProviders', () => ({
  ACTIVE_BIBLE_SOURCE: 'laravel',
  getBibleProvider: vi.fn(() => ({ getPassage: mockGetPassage, getNotes: mockGetNotes }))
}))

const { PassageRepository } = await import('../passageRepository')
const { getBibleProvider } = await import('../bibleProviders')

describe('PassageRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPassagesGet.mockResolvedValue(undefined)
    mockNotesGet.mockResolvedValue(undefined)
  })

  describe('get', () => {
    it('defaults to the laravel source when none is passed', async () => {
      mockGetPassage.mockResolvedValue({ verses: [] })

      await PassageRepository.get('PRO', 19, 'BSB')

      expect(mockPassagesGet).toHaveBeenCalledWith({ book: 'PRO', chapter: 19, translation: 'BSB', source: 'laravel' })
      expect(getBibleProvider).toHaveBeenCalledWith('laravel')
    })

    it('routes to the requested provider and caches the result keyed by source', async () => {
      mockGetPassage.mockResolvedValue({ verses: [{ number: 1, text: 'Hi' }] })

      const data = await PassageRepository.get('PRO', 19, 'BSB', 'freeuse')

      expect(getBibleProvider).toHaveBeenCalledWith('freeuse')
      expect(mockPassagesPut).toHaveBeenCalledWith(
        expect.objectContaining({ book: 'PRO', chapter: 19, translation: 'BSB', source: 'freeuse' })
      )
      expect(data).toEqual({ verses: [{ number: 1, text: 'Hi' }] })
    })

    it('returns the cached copy without re-fetching when present, but refreshes in the background', async () => {
      mockPassagesGet.mockResolvedValue({ content: { verses: ['cached'] } })
      mockGetPassage.mockResolvedValue({ verses: ['fresh'] })

      const data = await PassageRepository.get('PRO', 19, 'BSB', 'freeuse')

      expect(data).toEqual({ verses: ['cached'] })
      // background refresh is fire-and-forget but still calls the provider
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(mockGetPassage).toHaveBeenCalledWith('PRO', 19, 'BSB')
    })

    it('falls back to the bundled Proverbs 19 fixture when the provider throws and nothing is cached', async () => {
      mockGetPassage.mockRejectedValue(new Error('offline'))

      const data = await PassageRepository.get('PRO', 19, 'BSB', 'freeuse')

      expect(data.book).toBe('PRO')
      expect(data.chapter).toBe(19)
    })

    it('rethrows when the provider fails for a passage with no bundled fixture', async () => {
      mockGetPassage.mockRejectedValue(new Error('offline'))
      await expect(PassageRepository.get('GEN', 1, 'BSB', 'freeuse')).rejects.toThrow('offline')
    })
  })

  describe('getNotes', () => {
    it('does not cache a null result from providers that lack study notes (e.g. freeuse)', async () => {
      mockGetNotes.mockResolvedValue(null)

      const data = await PassageRepository.getNotes('GEN', 1, 'BSB', 'freeuse')

      expect(data).toBeNull()
      expect(mockNotesPut).not.toHaveBeenCalled()
    })

    it('caches a non-null notes result keyed by source', async () => {
      mockGetNotes.mockResolvedValue({ notes: [] })

      await PassageRepository.getNotes('PRO', 19, 'BSB', 'laravel')

      expect(mockNotesPut).toHaveBeenCalledWith(
        expect.objectContaining({ book: 'PRO', chapter: 19, translation: 'BSB', source: 'laravel' })
      )
    })
  })

  describe('downloadBook', () => {
    it('supports the legacy 4-arg call (source omitted, onProgress in its place)', async () => {
      mockGetPassage.mockResolvedValue({ verses: [] })
      const onProgress = vi.fn()

      await PassageRepository.downloadBook('PSA', 2, 'BSB', onProgress)

      expect(getBibleProvider).toHaveBeenCalledWith('laravel')
      expect(onProgress).toHaveBeenCalledTimes(2)
    })

    it('downloads every chapter through the specified source', async () => {
      mockGetPassage.mockResolvedValue({ verses: [] })

      await PassageRepository.downloadBook('PSA', 3, 'BSB', 'freeuse', () => {})

      expect(getBibleProvider).toHaveBeenCalledWith('freeuse')
      expect(mockGetPassage).toHaveBeenCalledTimes(3)
    })
  })
})
