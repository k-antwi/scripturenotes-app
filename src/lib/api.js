import axios from 'axios'
import { Preferences } from '@capacitor/preferences'

/**
 * Laravel API client (PRD §7).
 * Web builds use Sanctum session cookies; Capacitor builds attach a bearer
 * token, since a native WebView can't share first-party session cookies
 * with the API host (PRD §3 Authentication).
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
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
  register: (payload) => api.post('/auth/register', payload),
  login: (payload) => api.post('/auth/login', payload),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me')
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

export default api
