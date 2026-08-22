/**
 * Tests for VerseBlock — the phrase-anchored note indicator (PRD §5.3).
 *
 * Run with:  npx vitest run src/components/reader/__tests__/VerseBlock.test.js
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VerseBlock from '../VerseBlock.vue'

const VERSE = { number: 1, text: 'In the beginning God created the heavens and the earth.' }

function mountVerse(props = {}) {
  return mount(VerseBlock, {
    props: { book: 'GEN', chapter: 1, verse: VERSE, ...props },
  })
}

describe('VerseBlock — phrase note underlines', () => {
  it('renders no underline span when the verse has no phrase notes', () => {
    const wrapper = mountVerse()
    expect(wrapper.find('.phrase-note').exists()).toBe(false)
    expect(wrapper.find('.scripture-text').text()).toBe(VERSE.text)
  })

  it('underlines exactly the words a phrase note is anchored to', () => {
    const wrapper = mountVerse({
      phraseNotes: [{ localId: 12, char_start: 0, char_end: 16 }],
    })

    const marked = wrapper.findAll('.phrase-note')
    expect(marked).toHaveLength(1)
    expect(marked[0].text()).toBe('In the beginning')
    // The rest of the verse still reads normally
    expect(wrapper.find('.scripture-text').text()).toBe(VERSE.text)
  })

  it('emits phrase-note-tap with the note id when the underline is tapped', async () => {
    const wrapper = mountVerse({
      phraseNotes: [{ localId: 12, char_start: 17, char_end: 20 }],
    })

    await wrapper.find('.phrase-note').trigger('click')

    expect(wrapper.emitted('phrase-note-tap')).toEqual([[12]])
    // A phrase tap must not also fire the whole-verse handler
    expect(wrapper.emitted('verse-tap')).toBeUndefined()
  })

  it('does not emit phrase-note-tap when plain verse text is tapped', async () => {
    const wrapper = mountVerse({
      phraseNotes: [{ localId: 12, char_start: 0, char_end: 2 }],
    })

    await wrapper.find('.scripture-text').trigger('click')

    expect(wrapper.emitted('phrase-note-tap')).toBeUndefined()
  })

  it('shows the margin dot only when the verse carries whole-verse notes', async () => {
    expect(mountVerse().find('.note-dot').exists()).toBe(false)

    const wrapper = mountVerse({ hasNote: true })
    expect(wrapper.find('.note-dot').exists()).toBe(true)

    await wrapper.find('.note-dot').trigger('click')
    expect(wrapper.emitted('note-dot-tap')).toEqual([[1]])
  })

  it('still emits verse-tap from the verse number', async () => {
    const wrapper = mountVerse()
    await wrapper.find('.verse-num').trigger('click')
    expect(wrapper.emitted('verse-tap')).toEqual([[1]])
  })
})
