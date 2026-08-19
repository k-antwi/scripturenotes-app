import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HelloAoBibleClient } from '../helloaoClient'

describe('HelloAoBibleClient', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requests the translation books endpoint with the configured base URL', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ books: [] }) })

    const client = new HelloAoBibleClient({ endpoint: 'https://bible.helloao.org', useCache: false })
    await client.getTranslationBooks('BSB')

    expect(global.fetch).toHaveBeenCalledWith(
      'https://bible.helloao.org/api/BSB/books.json',
      expect.objectContaining({ headers: { Accept: 'application/json' } })
    )
  })

  it('requests a chapter using translation/book/chapter path segments', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ chapter: { number: 19 } }) })

    const client = new HelloAoBibleClient({ endpoint: 'https://bible.helloao.org', useCache: false })
    await client.getTranslationBookChapter('BSB', 'PRO', 19)

    expect(global.fetch).toHaveBeenCalledWith(
      'https://bible.helloao.org/api/BSB/PRO/19.json',
      expect.any(Object)
    )
  })

  it('throws with the status code when the response is not ok', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 404 })

    const client = new HelloAoBibleClient({ useCache: false })
    await expect(client.getTranslationBookChapter('BSB', 'XXX', 1)).rejects.toThrow(/404/)
  })

  it('caches identical requests when useCache is enabled (default)', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })

    const client = new HelloAoBibleClient()
    await client.getAvailableTranslations()
    await client.getAvailableTranslations()

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('bypasses the cache when useCache is false', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })

    const client = new HelloAoBibleClient({ useCache: false })
    await client.getAvailableTranslations()
    await client.getAvailableTranslations()

    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('strips a trailing slash from a custom endpoint', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) })

    const client = new HelloAoBibleClient({ endpoint: 'https://example.test/', useCache: false })
    await client.getAvailableTranslations()

    expect(global.fetch).toHaveBeenCalledWith('https://example.test/api/available_translations.json', expect.any(Object))
  })
})
