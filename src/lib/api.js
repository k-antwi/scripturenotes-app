import axios from 'axios'
import { Preferences } from '@capacitor/preferences'

/**
 * Laravel API client (PRD §7).
 *
 * baseURL strategy:
 *  - Browser dev  (npm run dev)  → VITE_API_BASE_URL is empty; axios sends
 *    relative paths (/api/…) which the Vite dev-server proxy forwards to the
 *    Laravel host. No cross-origin request ever leaves the browser, so CORS
 *    is a non-issue.
 *  - Capacitor / production build → VITE_API_BASE_URL is set to the full API
 *    host (e.g. http://localhost:58128 or https://api.biblestudy.app). The
 *    Laravel CORS config must explicitly allow the app origin with credentials.
 *
 * Web builds use Sanctum session cookies; Capacitor builds attach a bearer
 * token, since the native WebView can't share first-party cookies with the
 * API host (PRD §3 Authentication).
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  withCredentials: true,
  headers: { Accept: 'application/json' }
})

api.interceptors.request.use(async (config) => {
  const { value: token } = await Preferences.get({ key: 'auth_token' })
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

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

// --- Notes (user-authored scripture notes, PRD §5.3 / §6.5) -----------------
export const NoteAPI = {
  list: (params) => api.get('/api/notes', { params }),
  create: (payload) => api.post('/api/notes', payload),
  show: (id) => api.get(`/api/notes/${id}`),
  update: (id, payload) => api.put(`/api/notes/${id}`, payload),
  destroy: (id) => api.delete(`/api/notes/${id}`),
  forPassage: (book, chapter) => api.get(`/api/notes/passage/${book}/${chapter}`),
  sync: (mutations) => api.post('/api/notes/sync', { mutations }),
  notebookNotes: (notebookId, page = 1) =>
    api.get(`/api/notebooks/${notebookId}/notes`, { params: { page } }),
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
