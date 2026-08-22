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

/**
 * Note tool — "comment on a word or phrase" (PRD §5.3).
 *
 * resolvePhraseSelection() turns a drag-selection into a single note anchor:
 * verse + char range + the selected words. Offsets are measured from the
 * start of `.scripture-text`, so the verse number never counts toward them.
 */
describe('useTextSelection — phrase selection for the Note tool', () => {
  let container

  beforeEach(() => {
    setActivePinia(createPinia())
    document.body.innerHTML = ''
    container = buildPassageDom()
    stubRangeLayout(window.Range.prototype)
    useToolStore().setTool(TOOLS.NOTE)
  })

  function selectWithinVerseOne(start, end) {
    const textNode = container.querySelector('[data-verse="1"] .scripture-text').firstChild
    const range = document.createRange()
    range.setStart(textNode, start)
    range.setEnd(textNode, end)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
  }

  it('resolves a selected phrase to a verse anchor with char offsets and text', () => {
    selectWithinVerseOne(0, 6) // "Better"
    const { resolvePhraseSelection } = useTextSelection({ value: container })

    const anchor = resolvePhraseSelection()

    expect(anchor).toEqual({
      book: 'PRO',
      chapter: 19,
      verse: 1,
      charStart: 0,
      charEnd: 6,
      text: 'Better',
      spansMultipleVerses: false,
    })
  })

  it('measures offsets from the scripture text, excluding the verse number', () => {
    selectWithinVerseOne(9, 13) // "poor"
    const { resolvePhraseSelection } = useTextSelection({ value: container })

    const anchor = resolvePhraseSelection()

    expect(anchor.text).toBe('poor')
    expect(anchor.charStart).toBe(9)
    expect(anchor.charEnd).toBe(13)
  })

  it('anchors a cross-verse drag to the verse it starts in and flags the clipping', () => {
    const verse1Text = container.querySelector('[data-verse="1"] .scripture-text').firstChild
    const verse2Text = container.querySelector('[data-verse="2"] .scripture-text').firstChild
    const range = document.createRange()
    range.setStart(verse1Text, 7)
    range.setEnd(verse2Text, 9)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)

    const { resolvePhraseSelection } = useTextSelection({ value: container })
    const anchor = resolvePhraseSelection()

    expect(anchor.verse).toBe(1)
    expect(anchor.charStart).toBe(7)
    expect(anchor.spansMultipleVerses).toBe(true)
    expect(anchor.text).toBe('a poor man who walks with integrity')
  })

  it('clears the selection once resolved so the drag does not linger', () => {
    selectWithinVerseOne(0, 6)
    const { resolvePhraseSelection } = useTextSelection({ value: container })

    resolvePhraseSelection()

    expect(window.getSelection().rangeCount).toBe(0)
  })

  it('returns null when the Note tool is not the active tool', () => {
    useToolStore().setTool(TOOLS.HIGHLIGHTER)
    selectWithinVerseOne(0, 6)

    const { resolvePhraseSelection } = useTextSelection({ value: container })
    expect(resolvePhraseSelection()).toBeNull()
  })

  it('returns null for a tap (collapsed selection) rather than opening a dialog', () => {
    selectWithinVerseOne(4, 4)

    const { resolvePhraseSelection } = useTextSelection({ value: container })
    expect(resolvePhraseSelection()).toBeNull()
  })
})
