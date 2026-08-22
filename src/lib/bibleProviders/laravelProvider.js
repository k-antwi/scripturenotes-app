import { BibleAPI } from '@/lib/api'

/**
 * Laravel Bible provider — authenticated users only.
 *
 * Proxies through the unified Bible API gateway on the backend
 * (GET /api/bible/*). The gateway routes each request to the correct
 * upstream provider (API.Bible for licensed translations, Free Use for
 * public-domain, Bible Brain for audio, Bolls for semantic search).
 *
 * Requires a valid Sanctum Bearer token — the api.js interceptor attaches
 * it automatically when the user is logged in.
 *
 * Response envelope from backend:
 *   { data: { reference, version, verses[{ book, chapter, verse, verseId, text }] },
 *     meta: { provider, cached } }
 *
 * This provider unwraps `data.data` so callers receive the same shape
 * as freeUseBibleProvider — components never need to know which backend
 * served the text.
 */
export const laravelProvider = {
  id: 'laravel',
  label: 'Laravel Bible Gateway',

  /**
   * Fetch a full chapter.
   * Returns the unified passage shape: { reference, version, verses[], meta }
   */
  async getPassage(book, chapter, version) {
    const response = await BibleAPI.chapter(book, chapter, version)
    return unwrapEnvelope(response.data)
  },

  /**
   * Study notes are not yet served by the gateway — return null so the
   * caller's fallback renders without a wasted network call.
   */
  async getNotes() {
    return null
  },

  /**
   * Keyword or semantic search.
   * @param {string} query
   * @param {string} version
   * @param {'keyword'|'semantic'} type
   */
  async search(query, version, type = 'keyword') {
    const response = await BibleAPI.search(query, version, type)
    return unwrapEnvelope(response.data)
  },

  /**
   * Audio streaming URLs for a reference (from Bible Brain).
   * Returns { reference, version, audio[{ url, format, book, chapter }] }
   */
  async getAudio(ref, version) {
    const response = await BibleAPI.audio(ref, version)
    return response.data.data ?? response.data
  },

  /**
   * Verse of the Day (from YouVersion with Free Use fallback).
   * Returns the unified passage shape.
   */
  async getVerseOfDay() {
    const response = await BibleAPI.verseOfDay()
    return unwrapEnvelope(response.data)
  },

  /**
   * Bible dictionary lookup via Bolls.
   * Returns { word, definition }
   */
  async getDictionary(word) {
    const response = await BibleAPI.dictionary(word)
    return response.data.data ?? response.data
  },

  /**
   * Available translations — merged from API.Bible and Free Use.
   * Returns [{ id, name, abbreviation, language }]
   */
  async getAvailableTranslations(language = 'en') {
    const response = await BibleAPI.versions(language)
    return response.data.data ?? response.data
  }
}

/**
 * Unwrap the backend's unified envelope and attach meta as a sibling field.
 *
 * Backend:  { data: { reference, version, verses[] }, meta: { provider, cached } }
 * Returned: { reference, version, verses[], meta: { provider, cached } }
 *
 * The backend names the verse number field `verse`; every component in the
 * app (VerseBlock, useTextSelection, noteStore) expects `number`. We map it
 * here so providers stay interchangeable.
 */
function unwrapEnvelope(envelope) {
  const { data, meta } = envelope ?? {}
  const payload = data ?? {}
  return {
    ...payload,
    verses: (payload.verses ?? []).map(v => ({
      ...v,
      number: v.number ?? v.verse,
    })),
    meta,
  }
}

export default laravelProvider
