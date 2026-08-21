import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── DB mock ──────────────────────────────────────────────────────────────────

const mockPassagesGet = vi.fn()
const mockPassagesPut = vi.fn()
const mockNotesGet    = vi.fn()
const mockNotesPut    = vi.fn()

vi.mock('../db', () => ({
  db: {
    passages:   { get: mockPassagesGet, put: mockPassagesPut },
    studyNotes: { get: mockNotesGet,    put: mockNotesPut    }
  }
}))

// ─── Provider mock ────────────────────────────────────────────────────────────

const mockGetPassage = vi.fn()
const mockGetNotes   = vi.fn()

vi.mock('../bibleProviders', () => ({
  BIBLE_SOURCES: { LARAVEL: 'laravel', FREEUSE: 'freeuse' },
  getBibleProvider: vi.fn(() => ({ getPassage: mockGetPassage, getNotes: mockGetNotes }))
}))

// ─── Auth store mock ──────────────────────────────────────────────────────────

const mockAuthStore = { isAuthenticated: false }

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => mockAuthStore)
}))

// ─── Import after mocks ───────────────────────────────────────────────────────

const { PassageRepository } = await import('../passageRepository')
const { getBibleProvider, BIBLE_SOURCES } = await import('../bibleProviders')
const { useAuthStore } = await import('@/stores/auth')

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockAuthStore.isAuthenticated = false
  mockPassagesGet.mockResolvedValue(undefined)
  mockNotesGet.mockResolvedValue(undefined)
  useAuthStore.mockReturnValue(mockAuthStore)
})

// ─── _resolveSource — auth-aware routing ─────────────────────────────────────

describe('PassageRepository._resolveSource', () => {
  it('returns LARAVEL when the user is authenticated', () => {
    mockAuthStore.isAuthenticated = true
    expect(PassageRepository._resolveSource()).toBe(BIBLE_SOURCES.LARAVEL)
  })

  it('returns FREEUSE when the user is unauthenticated', () => {
    mockAuthStore.isAuthenticated = false
    expect(PassageRepository._resolveSource()).toBe(BIBLE_SOURCES.FREEUSE)
  })

  it('falls back to FREEUSE when Pinia is not yet mounted', () => {
    useAuthStore.mockImplementationOnce(() => { throw new Error('Pinia not mounted') })
    expect(PassageRepository._resolveSource()).toBe(BIBLE_SOURCES.FREEUSE)
  })
})

// ─── get ─────────────────────────────────────────────────────────────────────

describe('PassageRepository.get', () => {
  it('resolves to LARAVEL source when authenticated (no explicit source passed)', async () => {
    mockAuthStore.isAuthenticated = true
    mockGetPassage.mockResolvedValue({ verses: [] })

    await PassageRepository.get('PRO', 19, 'BSB')

    expect(mockPassagesGet).toHaveBeenCalledWith({ book: 'PRO', chapter: 19, translation: 'BSB', source: BIBLE_SOURCES.LARAVEL })
    expect(getBibleProvider).toHaveBeenCalledWith(BIBLE_SOURCES.LARAVEL)
  })

  it('resolves to FREEUSE source when unauthenticated (no explicit source passed)', async () => {
    mockAuthStore.isAuthenticated = false
    mockGetPassage.mockResolvedValue({ verses: [] })

    await PassageRepository.get('PRO', 19, 'BSB')

    expect(getBibleProvider).toHaveBeenCalledWith(BIBLE_SOURCES.FREEUSE)
  })

  it('honours an explicit source override regardless of auth state', async () => {
    mockAuthStore.isAuthenticated = true   // would normally pick LARAVEL
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

// ─── getNotes ─────────────────────────────────────────────────────────────────

describe('PassageRepository.getNotes', () => {
  it('resolves to LARAVEL when authenticated', async () => {
    mockAuthStore.isAuthenticated = true
    mockGetNotes.mockResolvedValue(null)

    await PassageRepository.getNotes('ROM', 8, 'ESV')

    expect(getBibleProvider).toHaveBeenCalledWith(BIBLE_SOURCES.LARAVEL)
  })

  it('resolves to FREEUSE when unauthenticated', async () => {
    mockAuthStore.isAuthenticated = false
    mockGetNotes.mockResolvedValue(null)

    await PassageRepository.getNotes('ROM', 8, 'ESV')

    expect(getBibleProvider).toHaveBeenCalledWith(BIBLE_SOURCES.FREEUSE)
  })

  it('does not cache a null result from providers that lack study notes', async () => {
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

// ─── downloadBook ─────────────────────────────────────────────────────────────

describe('PassageRepository.downloadBook', () => {
  it('supports the legacy 4-arg call (source omitted, onProgress in its place)', async () => {
    mockAuthStore.isAuthenticated = false
    mockGetPassage.mockResolvedValue({ verses: [] })
    const onProgress = vi.fn()

    await PassageRepository.downloadBook('PSA', 2, 'BSB', onProgress)

    expect(getBibleProvider).toHaveBeenCalledWith(BIBLE_SOURCES.FREEUSE)
    expect(onProgress).toHaveBeenCalledTimes(2)
  })

  it('downloads every chapter through the specified source', async () => {
    mockGetPassage.mockResolvedValue({ verses: [] })

    await PassageRepository.downloadBook('PSA', 3, 'BSB', 'freeuse', () => {})

    expect(getBibleProvider).toHaveBeenCalledWith('freeuse')
    expect(mockGetPassage).toHaveBeenCalledTimes(3)
  })

  it('uses LARAVEL for all chapters when authenticated and no source override given', async () => {
    mockAuthStore.isAuthenticated = true
    mockGetPassage.mockResolvedValue({ verses: [] })

    await PassageRepository.downloadBook('JHN', 2, 'NIV')

    expect(getBibleProvider).toHaveBeenCalledWith(BIBLE_SOURCES.LARAVEL)
    expect(mockGetPassage).toHaveBeenCalledTimes(2)
  })
})
