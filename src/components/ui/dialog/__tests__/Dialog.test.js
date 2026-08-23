/**
 * Tests for the Dialog wrapper's `dismissible` prop.
 *
 * The note editor sets dismissible=false so a half-written note survives a
 * stray tap on the backdrop or an accidental Escape — it may only be closed
 * with the X button (or an action inside it, such as Save).
 *
 * Run with:  npx vitest run src/components/ui/dialog/__tests__/Dialog.test.js
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import Dialog from '../Dialog.vue'

function mountDialog(props = {}) {
  return mount(Dialog, {
    props: { modelValue: true, title: 'Add note', ...props },
    slots: { default: '<textarea class="note-body" />' },
    attachTo: document.body,
  })
}

/** reka-ui portals the content to <body>, outside the wrapper element. */
function dialogIsOpen() {
  return document.body.querySelector('[role="dialog"]') !== null
}

// `cancelable` matters: reka-ui only honours preventDefault() on a
// cancelable event, and real browser keydown/pointerdown events are.
function pressEscape() {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  )
}

// reka-ui attaches its outside-pointer listener in a setTimeout(0), so the
// tap has to wait a macrotask or it lands before anything is listening.
async function tapBackdrop() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  const overlay = document.body.querySelector('.fixed.inset-0.z-50') ?? document.body
  overlay.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, button: 0, pointerType: 'mouse'
    })
  )
}

describe('Dialog — dismissible', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('opens with its content and a close button', async () => {
    const wrapper = mountDialog({ dismissible: false })
    await nextTick()

    expect(dialogIsOpen()).toBe(true)
    expect(document.body.querySelector('.note-body')).not.toBeNull()
    wrapper.unmount()
  })

  it('[note taking] stays open when Escape is pressed', async () => {
    const wrapper = mountDialog({ dismissible: false })
    await nextTick()

    pressEscape()
    await nextTick()

    expect(dialogIsOpen()).toBe(true)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })

  it('[note taking] stays open when the backdrop is tapped', async () => {
    const wrapper = mountDialog({ dismissible: false })
    await nextTick()

    await tapBackdrop()
    await nextTick()

    expect(dialogIsOpen()).toBe(true)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })

  it('[note taking] still closes when the X button is clicked', async () => {
    const wrapper = mountDialog({ dismissible: false })
    await nextTick()

    const closeButton = document.body.querySelector('[role="dialog"] button')
    closeButton.click()
    await nextTick()

    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    wrapper.unmount()
  })

  it('a dismissible dialog (the default) still closes on a backdrop tap', async () => {
    const wrapper = mountDialog()
    await nextTick()

    await tapBackdrop()
    await nextTick()

    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    wrapper.unmount()
  })

  it('a dismissible dialog (the default) still closes on Escape', async () => {
    const wrapper = mountDialog()
    await nextTick()

    pressEscape()
    await nextTick()

    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    wrapper.unmount()
  })
})
