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

// --- §7.1 Auth -------------------------------------------------------------
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

// --- §7.3 Passages (cache proxy) --------------------------------------------
export const PassageAPI = {
  get: (book, chapter, translation) =>
    api.get(`/api/passages/${book}/${chapter}`, { params: { translation } }),
  notes: (book, chapter, translation) =>
    api.get(`/api/passages/${book}/${chapter}/notes`, { params: { translation } })
}

// --- §7.4 Bookmarks -----------------------------------------------------------
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
