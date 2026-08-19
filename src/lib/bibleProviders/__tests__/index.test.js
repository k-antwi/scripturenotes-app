import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BIBLE_SOURCES, getBibleProvider, isValidBibleSource, laravelProvider, freeUseBibleProvider } from '../index'

describe('bibleProviders/index', () => {
  it('resolves the laravel source to the laravel provider', () => {
    expect(getBibleProvider(BIBLE_SOURCES.LARAVEL)).toBe(laravelProvider)
  })

  it('resolves the freeuse source to the freeUseBibleProvider', () => {
    expect(getBibleProvider(BIBLE_SOURCES.FREEUSE)).toBe(freeUseBibleProvider)
  })

  it('falls back to the laravel provider for an unknown/undefined source', () => {
    expect(getBibleProvider('made-up')).toBe(laravelProvider)
    expect(getBibleProvider(undefined)).toBe(laravelProvider)
  })

  it('validates known source ids only', () => {
    expect(isValidBibleSource('laravel')).toBe(true)
    expect(isValidBibleSource('freeuse')).toBe(true)
    expect(isValidBibleSource('other')).toBe(false)
    expect(isValidBibleSource(undefined)).toBe(false)
  })
})

// ACTIVE_BIBLE_SOURCE is read from import.meta.env.VITE_DEFAULT_BIBLE_SOURCE
// once at module load, so each scenario needs a fresh module instance with
// the env var stubbed beforehand.
describe('bibleProviders/index — ACTIVE_BIBLE_SOURCE (deploy-time config only)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('honors a valid VITE_DEFAULT_BIBLE_SOURCE', async () => {
    vi.stubEnv('VITE_DEFAULT_BIBLE_SOURCE', 'freeuse')
    vi.resetModules()
    const mod = await import('../index')
    expect(mod.ACTIVE_BIBLE_SOURCE).toBe('freeuse')
    expect(mod.getActiveBibleProvider()).toBe(mod.freeUseBibleProvider)
  })

  it('falls back to laravel when VITE_DEFAULT_BIBLE_SOURCE is unset or invalid', async () => {
    vi.stubEnv('VITE_DEFAULT_BIBLE_SOURCE', 'not-a-real-source')
    vi.resetModules()
    const mod = await import('../index')
    expect(mod.ACTIVE_BIBLE_SOURCE).toBe('laravel')
    expect(mod.getActiveBibleProvider()).toBe(mod.laravelProvider)
  })
})
