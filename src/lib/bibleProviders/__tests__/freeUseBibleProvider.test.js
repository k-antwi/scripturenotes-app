import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetTranslationBookChapter = vi.fn()
const mockGetAvailableTranslations = vi.fn()
const mockGetTranslationBooks = vi.fn()

vi.mock('../helloaoClient', () => ({
  HelloAoBibleClient: vi.fn(function HelloAoBibleClient() {
    this.getTranslationBookChapter = mockGetTranslationBookChapter
    this.getAvailableTranslations = mockGetAvailableTranslations
    this.getTranslationBooks = mockGetTranslationBooks
  })
}))

const { freeUseBibleProvider } = await import('../freeUseBibleProvider')

describe('freeUseBibleProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches a chapter from the helloao client and normalizes it', async () => {
    mockGetTranslationBookChapter.mockResolvedValue({
      chapter: {
        number: 19,
        content: [{ type: 'verse', number: 1, content: [{ text: 'Hello.' }] }],
        footnotes: []
      }
    })

    const result = await freeUseBibleProvider.getPassage('PRO', 19, 'BSB')

    expect(mockGetTranslationBookChapter).toHaveBeenCalledWith('BSB', 'PRO', 19)
    expect(result.book).toBe('PRO')
    expect(result.chapter).toBe(19)
    expect(result.translation).toBe('BSB')
    expect(result.verses).toEqual([{ number: 1, text: 'Hello.' }])
  })

  it('returns null for getNotes without making a network call', async () => {
    const result = await freeUseBibleProvider.getNotes('PRO', 19, 'BSB')
    expect(result).toBeNull()
    expect(mockGetTranslationBookChapter).not.toHaveBeenCalled()
  })

  it('propagates errors from the underlying client', async () => {
    mockGetTranslationBookChapter.mockRejectedValue(new Error('Free Use Bible API request failed (404)'))
    await expect(freeUseBibleProvider.getPassage('XXX', 1, 'BSB')).rejects.toThrow('404')
  })

  it('delegates getAvailableTranslations and getBooks to the client', async () => {
    mockGetAvailableTranslations.mockResolvedValue({ translations: [] })
    mockGetTranslationBooks.mockResolvedValue({ books: [] })

    await freeUseBibleProvider.getAvailableTranslations()
    await freeUseBibleProvider.getBooks('BSB')

    expect(mockGetAvailableTranslations).toHaveBeenCalled()
    expect(mockGetTranslationBooks).toHaveBeenCalledWith('BSB')
  })
})
