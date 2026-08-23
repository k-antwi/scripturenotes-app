/**
 * ReaderView records the passage being read so the Read tab can return to it.
 *
 * Run with:  npx vitest run src/views/__tests__/ReaderView.test.js
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, reactive, nextTick } from 'vue'
import { useReadingStore } from '@/stores/reading'

const route = reactive({ params: { book: 'JHN', chapter: '3' }, query: {} })
vi.mock('vue-router', () => ({ useRoute: () => route }))

const ScriptureReaderStub = defineComponent({
  name: 'ScriptureReaderStub',
  props: ['book', 'chapter'],
  template: '<div />'
})
vi.mock('@/components/reader/ScriptureReader.vue', () => ({ default: ScriptureReaderStub }))

describe('ReaderView — current passage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    route.params = { book: 'JHN', chapter: '3' }
  })

  async function mountView() {
    const { default: ReaderView } = await import('../ReaderView.vue')
    return mount(ReaderView)
  }

  it('records the passage it opens on', async () => {
    await mountView()
    expect(useReadingStore().lastPassagePath).toBe('/read/JHN/3')
  })

  it('updates the remembered passage when the route changes chapter', async () => {
    await mountView()
    route.params = { book: 'ROM', chapter: '8' }
    await nextTick()

    expect(useReadingStore().lastPassagePath).toBe('/read/ROM/8')
  })

  it('passes the route passage through to the reader, upper-cased', async () => {
    route.params = { book: 'jhn', chapter: '3' }
    const wrapper = await mountView()

    const reader = wrapper.findComponent(ScriptureReaderStub)
    expect(reader.props()).toEqual({ book: 'JHN', chapter: 3 })
  })

  it('records the default passage when the route carries no params', async () => {
    route.params = {}
    await mountView()

    expect(useReadingStore().lastPassagePath).toBe('/read/PRO/19')
  })
})
