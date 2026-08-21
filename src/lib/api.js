import { Preferences } from '@capacitor/preferences'

/**
 * Laravel API client (PRD §7).
 *
 * Built on the platform `fetch`, with a thin axios-shaped wrapper so callers
 * keep working with `{ data }` responses and `err.response.{status,data}`
 * errors.
 *
 * baseURL strategy:
 *  - Browser dev  (npm run dev)  → VITE_API_BASE_URL is empty; requests use
 *    relative paths (/api/…) which the Vite dev-server proxy forwards to the
 *    Laravel host. No cross-origin request ever leaves the browser, so CORS
 *    is a non-issue.
 *  - Capacitor / production build → VITE_API_BASE_URL is set to the full API
 *    host (e.g. http://localhost:58128 or https://api.biblestudy.app). The
 *    Laravel CORS config must explicitly allow the app origin with credentials.
 *
 * Web builds use Sanctum session cookies (credentials: 'include'); Capacitor
 * builds attach a bearer token, since the native WebView can't share
 * first-party cookies with the API host (PRD §3 Authentication).
 */
const baseURL = import.meta.env.VITE_API_BASE_URL || ''

/**
 * Error thrown for both transport failures and non-2xx responses.
 *
 * `response` is populated only when the server actually answered, mirroring
 * axios so existing `err.response?.status` / `err.response.data` checks
 * (e.g. the 409 conflict path in syncService) keep working.
 */
export class ApiError extends Error {
  constructor(message, { response = null, cause = undefined } = {}) {
    super(message)
    this.name = 'ApiError'
    this.response = response
    if (cause !== undefined) this.cause = cause
  }
}

/** Serialise `params` the way axios does: skip null/undefined, repeat arrays. */
function buildUrl(url, params) {
  const absolute = /^https?:\/\//i.test(url) ? url : `${baseURL}${url}`
  if (!params) return absolute

  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== null && item !== undefined) search.append(`${key}[]`, item)
      }
    } else {
      search.append(key, value)
    }
  }

  const query = search.toString()
  if (!query) return absolute
  return absolute + (absolute.includes('?') ? '&' : '?') + query
}

/** Parse by content type, falling back to raw text (and null for empty bodies). */
async function parseBody(response) {
  if (response.status === 204 || response.status === 205) return null

  const contentType = response.headers.get('content-type') || ''
  const text = await response.text()
  if (text === '') return null

  if (contentType.includes('json')) {
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }
  return text
}

async function request(method, url, { params, data, headers, signal } = {}) {
  const requestHeaders = { Accept: 'application/json', ...headers }

  const { value: token } = await Preferences.get({ key: 'auth_token' })
  if (token) requestHeaders.Authorization = `Bearer ${token}`

  const init = {
    method,
    // Sanctum session cookies for web builds — the axios `withCredentials` equivalent.
    credentials: 'include',
    headers: requestHeaders,
    signal
  }

  if (data !== undefined) {
    if (data instanceof FormData || data instanceof Blob || data instanceof URLSearchParams) {
      init.body = data
    } else {
      if (!requestHeaders['Content-Type']) requestHeaders['Content-Type'] = 'application/json'
      init.body = JSON.stringify(data)
    }
  }

  let response
  try {
    response = await fetch(buildUrl(url, params), init)
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new ApiError(`Network error: ${method} ${url}`, { cause: err })
  }

  const body = await parseBody(response)
  const result = {
    data: body,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  }

  if (!response.ok) {
    throw new ApiError(
      `Request failed with status code ${response.status}`,
      { response: result }
    )
  }

  return result
}

export const api = {
  request,
  get: (url, config) => request('GET', url, config),
  delete: (url, config) => request('DELETE', url, config),
  post: (url, data, config) => request('POST', url, { ...config, data }),
  put: (url, data, config) => request('PUT', url, { ...config, data }),
  patch: (url, data, config) => request('PATCH', url, { ...config, data })
}

// --- §7.1 Auth ---------------------------------------------------------------
export const AuthAPI = {
  register: (payload) => api.post('/api/register', payload),
  login: (payload) => api.post('/api/login', payload),
  logout: () => api.post('/api/logout'),
  me: () => api.get('/api/user')
}

// --- §7.2 Annotations --------------------------------------------------------
export const AnnotationAPI = {
  list: (params) => api.get('/api/annotations', { params }),
  create: (payload) => api.post('/api/annotations', payload),
  update: (id, payload) => api.put(`/api/annotations/${id}`, payload),
  destroy: (id) => api.delete(`/api/annotations/${id}`),
  // Batch upsert for offline-first sync — the outbox is flushed through here
  sync: (mutations) => api.post('/api/annotations/sync', { mutations })
}

// --- §11.2 Annotation Sharing ------------------------------------------------
export const ShareAPI = {
  /** Generate (or fetch existing) share token for an annotation. */
  share: (id) => api.post(`/api/annotations/${id}/share`),
  /** Revoke public access for an annotation. */
  revoke: (id) => api.delete(`/api/annotations/${id}/share`),
  /** Fetch a publicly-shared annotation by its token (no auth required). */
  getShared: (token) => api.get(`/api/shared/${token}`)
}

// --- §7.3 Bible API — unified multi-provider gateway -------------------------
//
// All verse text is served through these endpoints. The backend decides which
// provider to use (API.Bible for licensed translations, Free Use for public
// domain). Requires Sanctum auth — use freeUseBibleProvider directly for
// unauthenticated access.
//
// Response envelope: { data: { reference, version, verses[] }, meta: { provider, cached } }
export const BibleAPI = {
  /** GET /api/bible/chapter?book=JHN&chapter=3&version=NIV */
  chapter: (book, chapter, version) =>
    api.get('/api/bible/chapter', { params: { book, chapter, version } }),

  /** GET /api/bible/passage?ref=John+3:16&version=NIV */
  passage: (ref, version) =>
    api.get('/api/bible/passage', { params: { ref, version } }),

  /** GET /api/bible/search?q=faith&version=KJV&type=keyword|semantic */
  search: (query, version, type = 'keyword') =>
    api.get('/api/bible/search', { params: { q: query, version, type } }),

  /** GET /api/bible/audio?ref=Psalm+23&version=KJV */
  audio: (ref, version) =>
    api.get('/api/bible/audio', { params: { ref, version } }),

  /** GET /api/bible/verse-of-day */
  verseOfDay: () =>
    api.get('/api/bible/verse-of-day'),

  /** GET /api/bible/dictionary?word=grace */
  dictionary: (word) =>
    api.get('/api/bible/dictionary', { params: { word } }),

  /** GET /api/bible/versions?language=en */
  versions: (language = 'en') =>
    api.get('/api/bible/versions', { params: { language } })
}

// --- §7.3 Passages (legacy cache proxy — kept for backward compatibility) ----
// Prefer BibleAPI for new code.
export const PassageAPI = {
  get: (book, chapter, translation) =>
    api.get(`/api/passages/${book}/${chapter}`, { params: { translation } }),
  notes: (book, chapter, translation) =>
    api.get(`/api/passages/${book}/${chapter}/notes`, { params: { translation } })
}

// --- §7.4 Bookmarks ----------------------------------------------------------
export const BookmarkAPI = {
  list: () => api.get('/api/bookmarks'),
  create: (payload) => api.post('/api/bookmarks', payload),
  destroy: (id) => api.delete(`/api/bookmarks/${id}`)
}

// --- Notebooks ----------------------------------------------------------------
export const NotebookAPI = {
  list: () => api.get('/api/notebooks'),
  create: (payload) => api.post('/api/notebooks', payload),
  show: (id) => api.get(`/api/notebooks/${id}`),
  update: (id, payload) => api.put(`/api/notebooks/${id}`, payload),
  destroy: (id) => api.delete(`/api/notebooks/${id}`),
  addAnnotation: (notebookId, annotationId) =>
    api.post(`/api/notebooks/${notebookId}/annotations/${annotationId}`),
  removeAnnotation: (notebookId, annotationId) =>
    api.delete(`/api/notebooks/${notebookId}/annotations/${annotationId}`)
}

// --- Custom Notes (user commentary) ------------------------------------------
export const CustomNoteAPI = {
  list: (params) => api.get('/api/custom-notes', { params }),
  create: (payload) => api.post('/api/custom-notes', payload),
  update: (id, payload) => api.put(`/api/custom-notes/${id}`, payload),
  destroy: (id) => api.delete(`/api/custom-notes/${id}`)
}

// --- Study Sessions ----------------------------------------------------------
export const StudySessionAPI = {
  list: () => api.get('/api/study-sessions'),
  start: (payload) => api.post('/api/study-sessions', payload),
  heartbeat: (id) => api.patch(`/api/study-sessions/${id}`)
}

export default api
