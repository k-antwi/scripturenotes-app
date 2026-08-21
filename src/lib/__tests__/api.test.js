import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPreferencesGet = vi.fn(async () => ({ value: null }))
vi.mock('@capacitor/preferences', () => ({
  Preferences: { get: (...args) => mockPreferencesGet(...args) }
}))

const jsonResponse = (body, { status = 200 } = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

let api
let ApiError

beforeEach(async () => {
  vi.clearAllMocks()
  mockPreferencesGet.mockResolvedValue({ value: null })
  vi.stubGlobal('fetch', vi.fn())
  ;({ api, ApiError } = await import('../api'))
})

describe('api client', () => {
  it('returns the parsed JSON body as `data`', async () => {
    fetch.mockResolvedValue(jsonResponse({ id: 7 }))

    const res = await api.get('/api/bookmarks')

    expect(res.data).toEqual({ id: 7 })
    expect(res.status).toBe(200)
  })

  it('serialises params into the query string, skipping null/undefined', async () => {
    fetch.mockResolvedValue(jsonResponse({}))

    await api.get('/api/bible/chapter', {
      params: { book: 'JHN', chapter: 3, version: null }
    })

    const [url] = fetch.mock.calls[0]
    expect(url).toBe('/api/bible/chapter?book=JHN&chapter=3')
  })

  it('sends JSON bodies with the right content type and credentials', async () => {
    fetch.mockResolvedValue(jsonResponse({ ok: true }))

    await api.post('/api/bookmarks', { verseId: 43003016 })

    const [, init] = fetch.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ verseId: 43003016 }))
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.credentials).toBe('include')
  })

  it('attaches the stored bearer token', async () => {
    mockPreferencesGet.mockResolvedValue({ value: 'tok-123' })
    fetch.mockResolvedValue(jsonResponse({}))

    await api.get('/api/user')

    const [, init] = fetch.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer tok-123')
  })

  it('throws an ApiError carrying the response for non-2xx replies', async () => {
    fetch.mockResolvedValue(jsonResponse({ message: 'Conflict' }, { status: 409 }))

    const err = await api.post('/api/annotations/sync', {}).catch((e) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect(err.response.status).toBe(409)
    expect(err.response.data).toEqual({ message: 'Conflict' })
  })

  it('throws an ApiError with no response on transport failure', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'))

    const err = await api.get('/api/user').catch((e) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect(err.response).toBeNull()
  })

  it('returns null data for empty bodies', async () => {
    fetch.mockResolvedValue(new Response(null, { status: 204 }))

    const res = await api.delete('/api/bookmarks/1')

    expect(res.data).toBeNull()
  })
})
