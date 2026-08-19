/**
 * Regression tests for useTextSelection.
 *
 * Run with:  npx vitest run src/composables/__tests__/useTextSelection.test.js
 *
 * BUG: resolveSelection() used to resolve a selection Range to a single
 * `[data-verse]` ancestor via `.closest()`. Because verses render inline,
 * one after another, inside a single <p> (see VerseBlock.vue /
 * ScriptureReader.vue), any drag-selection that crossed a verse boundary
 * had a `commonAncestorContainer` above every verse span (the shared <p>),
 * so `.closest('[data-verse]')` found nothing and resolveSelection()
 * silently returned null — no highlight, no error. Since verses are
 * separated only by a small inline <sup> marker, crossing a boundary is
 * the common case, not the edge case, which made the highlighter tool
 * feel completely broken.
 *
 * FIX: resolveSelection() now finds every `[data-verse]` element the
 * range overlaps and returns one clipped result per verse.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useToolStore, TOOLS } from '@/stores/tool'
import { useTextSelection } from '../useTextSelection'

function buildPassageDom() {
  const container = document.createElement('div')
  container.innerHTML = `
    <p>
      <span data-verse="1" data-book="PRO" data-chapter="19">
        <sup>1</sup><span class="scripture-text">Better a poor man who walks with integrity</span>
      </span>
      <span data-verse="2" data-book="PRO" data-chapter="19">
        <sup>2</sup><span class="scripture-text">than one who has perverse lips and is a fool.</span>
      </span>
    </p>
  `
  document.body.appendChild(container)
  return container
}

/** jsdom doesn't implement Range.getClientRects() — stub it to look like one line. */
function stubRangeLayout(RangeProto) {
  RangeProto.getClientRects = function () {
    if (this.collapsed) return []
    return [{ left: 0, top: 0, width: 100, height: 20 }]
  }
}

describe('useTextSelection — cross-verse selection', () => {
  let container

  beforeEach(() => {
    setActivePinia(createPinia())
    document.body.innerHTML = ''
    container = buildPassageDom()
    stubRangeLayout(window.Range.prototype)
    useToolStore().setTool(TOOLS.HIGHLIGHTER)
  })

  function selectAcrossVerses() {
    const verse1Text = container.querySelector('[data-verse="1"] .scripture-text').firstChild
    const verse2Text = container.querySelector('[data-verse="2"] .scripture-text').firstChild

    const range = document.createRange()
    range.setStart(verse1Text, 7) // inside "Better a poor man..."
    range.setEnd(verse2Text, 9) // inside "than one who..."

    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    return selection
  }

  it('[regression] returns a highlight entry for EACH verse the drag crosses, not null', () => {
    selectAcrossVerses()
    const { resolveSelection } = useTextSelection({ value: container })

    const results = resolveSelection()

    expect(results).not.toBeNull()
    expect(results).toHaveLength(2)
    expect(results[0].verse).toBe(1)
    expect(results[1].verse).toBe(2)
    // Each per-verse chunk carries its own book/chapter and at least one rect
    // to render.
    for (const r of results) {
      expect(r.book).toBe('PRO')
      expect(r.chapter).toBe(19)
      expect(r.rects.length).toBeGreaterThan(0)
      expect(r.charStart).not.toBe(r.charEnd)
    }
  })

  it('still returns a single-entry result for a selection inside one verse', () => {
    const verse1Text = container.querySelector('[data-verse="1"] .scripture-text').firstChild
    const range = document.createRange()
    range.setStart(verse1Text, 0)
    range.setEnd(verse1Text, 6)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)

    const { resolveSelection } = useTextSelection({ value: container })
    const results = resolveSelection()

    expect(results).toHaveLength(1)
    expect(results[0].verse).toBe(1)
  })

  it('returns null when no text tool is active', () => {
    useToolStore().setTool(TOOLS.NONE)
    selectAcrossVerses()

    const { resolveSelection } = useTextSelection({ value: container })
    expect(resolveSelection()).toBeNull()
  })

  it('returns null for a collapsed (empty) selection', () => {
    const verse1Text = container.querySelector('[data-verse="1"] .scripture-text').firstChild
    const range = document.createRange()
    range.setStart(verse1Text, 3)
    range.setEnd(verse1Text, 3)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)

    const { resolveSelection } = useTextSelection({ value: container })
    expect(resolveSelection()).toBeNull()
  })
})
