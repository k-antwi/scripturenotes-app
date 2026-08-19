import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore } from '@/stores/settings'

// Note: which Bible backend the app talks to (Laravel vs. Free Use Bible API)
// is deploy-time config only (VITE_DEFAULT_BIBLE_SOURCE) — see
// src/lib/bibleProviders/__tests__/index.test.js. It intentionally isn't a
// field on this store, so there's nothing to test for it here.

describe('useSettingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('clamps font size to the 12–24px range', () => {
    const store = useSettingsStore()
    store.setFontSize(4)
    expect(store.fontSize).toBe(12)
    store.setFontSize(99)
    expect(store.fontSize).toBe(24)
    store.setFontSize(18)
    expect(store.fontSize).toBe(18)
  })

  it('clamps line height to the 1.4–2.0 range', () => {
    const store = useSettingsStore()
    store.setLineHeight(1.0)
    expect(store.lineHeight).toBe(1.4)
    store.setLineHeight(3.0)
    expect(store.lineHeight).toBe(2.0)
  })

  it('ignores an unrecognized theme', () => {
    const store = useSettingsStore()
    store.setTheme('neon')
    expect(store.theme).toBe('light')
  })

  it('accepts a valid theme', () => {
    const store = useSettingsStore()
    store.setTheme('dark')
    expect(store.theme).toBe('dark')
  })
})
