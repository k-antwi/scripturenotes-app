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
      // Wave/JWT returns { access_token, token_type, expires_in } — no user object
      this.token = data.access_token
      await Preferences.set({ key: 'auth_token', value: data.access_token })
      await this.fetchMe()
    },
    async register(payload) {
      const { data } = await AuthAPI.register(payload)
      this.token = data.access_token
      await Preferences.set({ key: 'auth_token', value: data.access_token })
      await this.fetchMe()
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
