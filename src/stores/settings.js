import { defineStore } from 'pinia'

const THEMES = ['light', 'dark', 'sepia']

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    theme: 'light', // light | dark | sepia — PRD §6.2
    fontSize: 17, // 12–24px, 2px increments — PRD §6.3
    lineHeight: 1.6, // 1.4–2.0 — PRD §6.3
    defaultTranslation: 'BSB', // public-domain default per PRD §11.5
    twoColumnPreferred: true, // used above the 768px breakpoint (PRD §6.1)
    penFeel: {
      // perfect-freehand parameters exposed via the 'Pen Feel' panel (PRD §5.2.2)
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.5
    }
  }),
  actions: {
    setTheme(theme) {
      if (!THEMES.includes(theme)) return
      this.theme = theme
      this.applyTheme()
    },
    applyTheme() {
      const root = document.documentElement
      root.classList.remove('dark', 'sepia')
      if (this.theme !== 'light') root.classList.add(this.theme)
    },
    setFontSize(px) {
      this.fontSize = Math.min(24, Math.max(12, px))
    },
    setLineHeight(value) {
      this.lineHeight = Math.min(2.0, Math.max(1.4, value))
    }
  },
  persist: true
})
