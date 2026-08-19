import { defineStore } from 'pinia'
import { Preferences } from '@capacitor/preferences'
import { AuthAPI } from '@/lib/api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: null
  }),
  getters: {
    isAuthenticated: (state) => !!state.user
  },
  actions: {
    async login(credentials) {
      const { data } = await AuthAPI.login(credentials)
      this.user = data.user
      // Web (Inertia/Sanctum) uses the session cookie; Capacitor builds
      // also receive a bearer token since the native WebView is a
      // separate origin from the API (PRD §3 Authentication).
      if (data.token) {
        this.token = data.token
        await Preferences.set({ key: 'auth_token', value: data.token })
      }
    },
    async register(payload) {
      const { data } = await AuthAPI.register(payload)
      this.user = data.user
      if (data.token) {
        this.token = data.token
        await Preferences.set({ key: 'auth_token', value: data.token })
      }
    },
    async fetchMe() {
      try {
        const { data } = await AuthAPI.me()
        this.user = data
      } catch {
        this.user = null
      }
    },
    async logout() {
      try {
        await AuthAPI.logout()
      } finally {
        this.user = null
        this.token = null
        await Preferences.remove({ key: 'auth_token' })
      }
    }
  },
  persist: {
    paths: ['user']
  }
})
