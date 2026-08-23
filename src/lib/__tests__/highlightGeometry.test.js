/**
 * Tests for highlight geometry — the text anchoring that keeps a highlight on
 * its words across screen sizes.
 *
 * Run with:  npx vitest run src/lib/__tests__/highlightGeometry.test.js
 *
 * jsdom performs no layout, so `Range.getClientRects()` returns nothing on its
 * own. The tests that care about rectangles stub it with a fake line-box
 * layout; the rest exercise the anchoring itself, which is where the bug lived
 * — the old code never resolved an anchor at all, it replayed stored pixels.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  verseTextElement,
  rangeForCharRange,
  rectsForAnchor,
  buildHighlightBoxes
} from '../highlightGeometry'
import { buildVerseHtml } from '../verseSegments'

const VERSE_1 = 'Better a poor man who walks with integrity'
const VERSE_2 = 'Desire without knowledge is not good'

/**
 * Builds a scroll container holding two verses, mirroring VerseBlock's markup:
 * a verse-number <sup> outside `.scripture-text`, and verse text rendered as
 * HTML so footnote markers and phrase-note spans nest inside it.
 */
function mountContainer({ verse1Html = VERSE_1, scrollTop = 0, scrollLeft = 0 } = {}) {
  const container = document.createElement('div')
  container.innerHTML = `
    <p>
      <span data-verse="1" data-book="PRO" data-chapter="19">
        <sup class="verse-num">1</sup><span class="scripture-text">${verse1Html}</span>
      </span>
      <span data-verse="2" data-book="PRO" data-chapter="19">
        <sup class="verse-num">2</sup><span class="scripture-text">${VERSE_2}</span>
      </span>
    </p>`
  document.body.appendChild(container)

  Object.defineProperty(container, 'scrollTop', { configurable: true, value: scrollTop })
  Object.defineProperty(container, 'scrollLeft', { configurable: true, value: scrollLeft })
  container.getBoundingClientRect = () => ({ left: 10, top: 20, width: 375, height: 600 })

  return container
}

/**
 * Pretends the browser laid the range out as the given line boxes.
 * jsdom does not implement Range.getClientRects at all, so this defines it
 * rather than spying on it.
 */
function stubLayout(rects) {
  Range.prototype.getClientRects = () => rects
}

function clearLayout() {
  delete Range.prototype.getClientRects
}

const highlight = (overrides = {}) => ({
  localId: 1,
  type: 'highlight',
  colour: '#FFE08A',
  book: 'PRO',
  chapter: 19,
  verse: 1,
  data: { charStart: 9, charEnd: 13, opacity: 0.35 },
  ...overrides
})

afterEach(() => {
  clearLayout()
  document.body.innerHTML = ''
})

describe('verseTextElement', () => {
  let container
  beforeEach(() => { container = mountContainer() })

  it('returns the .scripture-text of the matching verse', () => {
    const el = verseTextElement(container, { book: 'PRO', chapter: 19, verse: 2 })
    expect(el.textContent).toBe(VERSE_2)
  })

  it('excludes the verse number, so offset 0 is the first letter of scripture', () => {
    const el = verseTextElement(container, { book: 'PRO', chapter: 19, verse: 1 })
    expect(el.textContent.startsWith('Better')).toBe(true)
  })

  it('matches a numeric chapter against the string data attribute', () => {
    expect(verseTextElement(container, { book: 'PRO', chapter: 19, verse: 1 })).not.toBeNull()
  })

  it('returns null for a verse that is not rendered', () => {
    expect(verseTextElement(container, { book: 'PRO', chapter: 19, verse: 99 })).toBeNull()
  })

  it('returns null when the book does not match', () => {
    expect(verseTextElement(container, { book: 'ROM', chapter: 19, verse: 1 })).toBeNull()
  })
})

describe('rangeForCharRange', () => {
  it('selects exactly the characters the offsets name', () => {
    const container = mountContainer()
    const textEl = verseTextElement(container, { book: 'PRO', chapter: 19, verse: 1 })
    expect(rangeForCharRange(textEl, 9, 13).toString()).toBe('poor')
  })

  it('walks across nested markup — a phrase-note span splits the text nodes', () => {
    const html = buildVerseHtml(VERSE_1, [{ charStart: 0, charEnd: 6, noteLocalId: 7 }])
    const container = mountContainer({ verse1Html: html })
    const textEl = verseTextElement(container, { book: 'PRO', chapter: 19, verse: 1 })

    // "poor" now sits in a later text node, after the wrapped "Better" span.
    expect(textEl.querySelector('.phrase-note')).not.toBeNull()
    expect(rangeForCharRange(textEl, 9, 13).toString()).toBe('poor')
  })

  it('counts a footnote marker as the single character it renders as', () => {
    const container = mountContainer({ verse1Html: buildVerseHtml('Better[a] a poor man') })
    const textEl = verseTextElement(container, { book: 'PRO', chapter: 19, verse: 1 })

    // Rendered as "Bettera a poor man": the [a] marker collapses to the single
    // character a reader sees, putting "poor" at 10–14 rather than 9–13.
    expect(textEl.textContent).toBe('Bettera a poor man')
    expect(rangeForCharRange(textEl, 10, 14).toString()).toBe('poor')
  })

  it('spans a range that starts in one node and ends in another', () => {
    const html = buildVerseHtml(VERSE_1, [{ charStart: 0, charEnd: 6, noteLocalId: 7 }])
    const container = mountContainer({ verse1Html: html })
    const textEl = verseTextElement(container, { book: 'PRO', chapter: 19, verse: 1 })
    expect(rangeForCharRange(textEl, 2, 13).toString()).toBe('tter a poor')
  })

  it('returns null for a collapsed or inverted range', () => {
    const container = mountContainer()
    const textEl = verseTextElement(container, { book: 'PRO', chapter: 19, verse: 1 })
    expect(rangeForCharRange(textEl, 5, 5)).toBeNull()
    expect(rangeForCharRange(textEl, 9, 4)).toBeNull()
  })

  it('returns null when the range runs past the end of the verse', () => {
    const container = mountContainer()
    const textEl = verseTextElement(container, { book: 'PRO', chapter: 19, verse: 1 })
    expect(rangeForCharRange(textEl, 0, VERSE_1.length + 5)).toBeNull()
  })
})

describe('rectsForAnchor', () => {
  const anchor = { book: 'PRO', chapter: 19, verse: 1, charStart: 9, charEnd: 13 }

  it('reports rects in the container scroll-space', () => {
    const container = mountContainer({ scrollTop: 200, scrollLeft: 0 })
    stubLayout([{ left: 40, top: 90, width: 55, height: 22 }])

    expect(rectsForAnchor(container, anchor)).toEqual([
      // left 40 − container left 10; top 90 − container top 20 + scrollTop 200
      { x: 30, y: 270, width: 55, height: 22 }
    ])
  })

  it('returns one rect per line box, so a wrapped phrase is fully covered', () => {
    const container = mountContainer()
    stubLayout([
      { left: 200, top: 40, width: 120, height: 22 },
      { left: 10, top: 62, width: 80, height: 22 }
    ])
    expect(rectsForAnchor(container, anchor)).toHaveLength(2)
  })

  /**
   * THE BUG. The same annotation, measured against two different layouts,
   * has to produce two different sets of rectangles. The old renderer replayed
   * one stored rect and so drew the band wherever the phone that created it
   * had happened to put the words.
   */
  it('tracks the words when the text reflows', () => {
    const container = mountContainer()

    stubLayout([{ left: 210, top: 40, width: 60, height: 22 }])
    const narrow = rectsForAnchor(container, anchor)

    clearLayout()
    container.getBoundingClientRect = () => ({ left: 10, top: 20, width: 900, height: 600 })
    stubLayout([{ left: 610, top: 24, width: 60, height: 26 }])
    const wide = rectsForAnchor(container, anchor)

    expect(narrow).not.toEqual(wide)
    expect(wide[0]).toEqual({ x: 600, y: 4, width: 60, height: 26 })
  })

  it('drops collapsed rects at line-wrap boundaries', () => {
    const container = mountContainer()
    stubLayout([
      { left: 40, top: 90, width: 55, height: 22 },
      { left: 95, top: 90, width: 0, height: 22 }
    ])
    expect(rectsForAnchor(container, anchor)).toHaveLength(1)
  })

  it('returns nothing when the verse is not on screen', () => {
    const container = mountContainer()
    stubLayout([{ left: 40, top: 90, width: 55, height: 22 }])
    expect(rectsForAnchor(container, { ...anchor, verse: 99 })).toEqual([])
  })
})

describe('buildHighlightBoxes', () => {
  it('produces one box per line box, carrying colour and opacity', () => {
    const container = mountContainer()
    stubLayout([
      { left: 40, top: 90, width: 55, height: 22 },
      { left: 10, top: 112, width: 30, height: 22 }
    ])

    const boxes = buildHighlightBoxes(container, [highlight()])
    expect(boxes).toHaveLength(2)
    expect(boxes[0]).toMatchObject({ type: 'highlight', colour: '#FFE08A', opacity: 0.35, localIds: [1] })
    expect(new Set(boxes.map((b) => b.key)).size).toBe(2)
  })

  /**
   * Highlights used to be written one row per line box, every row repeating
   * the same char range. Re-deriving geometry would otherwise paint each of
   * those rows over the same words and stack the translucent bands.
   */
  it('collapses legacy one-row-per-line-box records into a single mark', () => {
    const container = mountContainer()
    stubLayout([{ left: 40, top: 90, width: 55, height: 22 }])

    const boxes = buildHighlightBoxes(container, [
      highlight({ localId: 1 }),
      highlight({ localId: 2 }),
      highlight({ localId: 3 })
    ])

    expect(boxes).toHaveLength(1)
    expect(boxes[0].localIds).toEqual([1, 2, 3])
  })

  it('keeps distinct marks apart', () => {
    const container = mountContainer()
    stubLayout([{ left: 40, top: 90, width: 55, height: 22 }])

    const boxes = buildHighlightBoxes(container, [
      highlight({ localId: 1 }),
      highlight({ localId: 2, data: { charStart: 20, charEnd: 25, opacity: 0.35 } }),
      highlight({ localId: 3, type: 'underline', colour: '#E4572E', data: { charStart: 9, charEnd: 13 } })
    ])

    expect(boxes).toHaveLength(3)
    expect(boxes.map((b) => b.localIds)).toEqual([[1], [2], [3]])
  })

  it('ignores pen and shape annotations', () => {
    const container = mountContainer()
    stubLayout([{ left: 40, top: 90, width: 55, height: 22 }])
    const boxes = buildHighlightBoxes(container, [
      { localId: 5, type: 'pen', data: { svgPath: 'M0 0' } },
      { localId: 6, type: 'shape', data: { points: [] } }
    ])
    expect(boxes).toEqual([])
  })

  it('falls back to the stored rect for a record with no char anchor', () => {
    const container = mountContainer()
    const boxes = buildHighlightBoxes(container, [
      highlight({ localId: 9, data: { rect: { x: 12, y: 340, width: 80, height: 21 }, opacity: 0.35 } })
    ])
    expect(boxes).toHaveLength(1)
    expect(boxes[0].rect).toEqual({ x: 12, y: 340, width: 80, height: 21 })
  })

  it('defaults underline opacity to full and highlight opacity to 0.35', () => {
    const container = mountContainer()
    stubLayout([{ left: 40, top: 90, width: 55, height: 22 }])
    const boxes = buildHighlightBoxes(container, [
      highlight({ localId: 1, data: { charStart: 9, charEnd: 13 } }),
      highlight({ localId: 2, type: 'underline', data: { charStart: 20, charEnd: 25 } })
    ])
    expect(boxes[0].opacity).toBe(0.35)
    expect(boxes[1].opacity).toBe(1)
  })

  it('survives a null container and a non-array input', () => {
    expect(buildHighlightBoxes(null, [highlight()])).toEqual([])
    expect(buildHighlightBoxes(mountContainer(), null)).toEqual([])
  })
})
