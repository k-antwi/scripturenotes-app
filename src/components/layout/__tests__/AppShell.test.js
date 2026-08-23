/**
 * REGRESSION — the Read tab pointed at a hardcoded /read/PRO/19, so leaving
 * the reader for another tab and coming back reset the user to Proverbs 19
 * whatever they had been reading. It now follows the reading store.
 *
 * Run with:  npx vitest run src/components/layout/__tests__/AppShell.test.js
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive, nextTick, defineComponent } from 'vue'
import { useReadingStore } from '@/stores/reading'

const route = reactive({ name: 'notes', query: {} })
vi.mock('vue-router', () => ({ useRoute: () => route }))

vi.mock('../OfflineIndicator.vue', () => ({
  default: defineComponent({ template: '<div />' })
}))

const RouterLinkStub = defineComponent({
  props: { to: { type: [String, Object], required: true } },
  template: '<a :href="typeof to === \'string\' ? to : \'\'"><slot /></a>'
})

async function mountShell() {
  const { default: AppShell } = await import('../AppShell.vue')
  return mount(AppShell, { global: { stubs: { 'router-link': RouterLinkStub } } })
}

function readTabHref(wrapper) {
  return wrapper.findAll('a')[0].attributes('href')
}

describe('AppShell — Read tab destination', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    route.name = 'notes'
    route.query = {}
  })

  it('defaults to the default passage when nothing has been read yet', async () => {
    const wrapper = await mountShell()
    expect(readTabHref(wrapper)).toBe('/read/PRO/19')
  })

  it('[regression] returns to the passage the user was last reading', async () => {
    useReadingStore().setLastPassage('JHN', 3)
    const wrapper = await mountShell()

    expect(readTabHref(wrapper)).toBe('/read/JHN/3')
  })

  it('[regression] tracks a passage change made while another tab is open', async () => {
    const wrapper = await mountShell()
    useReadingStore().setLastPassage('ROM', 8)
    await nextTick()

    expect(readTabHref(wrapper)).toBe('/read/ROM/8')
  })

  it('leaves the other tab destinations alone', async () => {
    const wrapper = await mountShell()
    const hrefs = wrapper.findAll('a').map((a) => a.attributes('href'))
    expect(hrefs.slice(1)).toEqual(['/notes', '/bookmarks', '/history', '/settings'])
  })
})
