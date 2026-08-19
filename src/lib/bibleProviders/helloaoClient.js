/**
 * Minimal fetch-based client for the Free Use Bible API (bible.helloao.org).
 *
 * Mirrors the method names of the official `free-use-bible-api` JS/TS SDK
 * (https://bible.helloao.org/docs/sdks/javascript.html) so the surface is
 * familiar, but is implemented with the global `fetch` API directly rather
 * than pulling in the npm package — this keeps the mobile bundle free of an
 * extra dependency and matches how the rest of this codebase talks to
 * external HTTP APIs.
 *
 * Public endpoints used (per the SDK docs):
 *  - GET /api/available_translations.json
 *  - GET /api/{translation}/books.json
 *  - GET /api/{translation}/{book}/{chapter}.json
 */

const DEFAULT_ENDPOINT = 'https://bible.helloao.org'

export class HelloAoBibleClient {
  /**
   * @param {object} [options]
   * @param {string} [options.endpoint] Base API endpoint. Defaults to
   *   VITE_FREEUSE_BIBLE_API_URL, then https://bible.helloao.org.
   * @param {boolean} [options.useCache] Enable in-memory response caching
   *   (default: true), matching the SDK's `useCache` option.
   */
  constructor(options = {}) {
    this.endpoint = (
      options.endpoint ||
      import.meta.env?.VITE_FREEUSE_BIBLE_API_URL ||
      DEFAULT_ENDPOINT
    ).replace(/\/+$/, '')
    this.useCache = options.useCache ?? true
    this._cache = new Map()
  }

  async _get(path) {
    const url = `${this.endpoint}${path}`
    if (this.useCache && this._cache.has(url)) return this._cache.get(url)

    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) {
      throw new Error(`Free Use Bible API request failed (${res.status}): ${url}`)
    }
    const data = await res.json()
    if (this.useCache) this._cache.set(url, data)
    return data
  }

  /** List all available Bible translations. */
  getAvailableTranslations() {
    return this._get('/api/available_translations.json')
  }

  /** Retrieve the list of books for a translation. */
  getTranslationBooks(translation) {
    return this._get(`/api/${encodeURIComponent(translation)}/books.json`)
  }

  /** Fetch a specific chapter of a book within a translation. */
  getTranslationBookChapter(translation, book, chapter) {
    return this._get(
      `/api/${encodeURIComponent(translation)}/${encodeURIComponent(book)}/${encodeURIComponent(chapter)}.json`
    )
  }

  clearCache() {
    this._cache.clear()
  }
}

export default HelloAoBibleClient
