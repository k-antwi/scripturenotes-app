import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  ANCHOR_VERSION,
  computeLayoutKey,
  hasTextAnchor,
  locateCharOffset,
  resolveAnchorRects,
  resolveHighlightRects,
  toScrollSpaceRect,
  verseTextElement
} from '../annotationAnchors'

/**
 * jsdom performs no layout, so `Range.getClientRects()` always returns an
 * empty list. These tests stub it with a synthetic rect whose WIDTH is the
 * length of the text the range actually covers — which turns a geometry
 * assertion into a text assertion: if the width is 16, the anchor resolved
 * to exactly 16 characters, and we can check WHICH 16 via `range.toString()`.
 *
 * `linesFor` lets a test simulate a phrase wrapping across a line break by
 * returning more than one rect for a given string.
 */
let originalGetClientRects
let linesFor = null
const capturedRanges = []

function stubRangeRects() {
  originalGetClientRects = Range.prototype.getClientRects
  Range.prototype.getClientRects = function getClientRects() {
    const text = this.toString()
    capturedRanges.push(text)
    if (linesFor) return linesFor(text)
    return [{ left: 100, top: 200, width: text.length, height: 20 }]
  }
}

/** A reader column containing one chapter of verses. */
function buildReader(verses, { scrollTop = 0, scrollLeft = 0, rect } = {}) {
  const container = document.createElement('div')
  container.innerHTML = verses
    .map(
      (v) =>
        `<span data-verse="${v.number}" data-book="${v.book ?? 'JHN'}" data-chapter="${v.chapter ?? 3}">` +
        `<sup class="verse-num">${v.number}</sup>` +
        `<span class="scripture-text">${v.html}</span>` +
        `</span>`
    )
    .join('')
  document.body.appendChild(container)

  container.scrollTop = scrollTop
  container.scrollLeft = scrollLeft
  container.getBoundingClientRect = () => rect ?? { left: 10, top: 40, width: 375, height: 600 }
  return container
}

function highlight(overrides = {}) {
  return {
    localId: 1,
    type: 'highlight',
    colour: '#fde68a',
    book: 'JHN',
    chapter: 3,
    verse: 16,
    data: { anchorVersion: ANCHOR_VERSION, charStart: 0, charEnd: 16, opacity: 0.35 },
    ...overrides
  }
}

beforeEach(() => {
  stubRangeRects()
  capturedRanges.length = 0
  linesFor = null
})

afterEach(() => {
  Range.prototype.getClientRects = originalGetClientRects
  document.body.innerHTML = ''
})

describe('computeLayoutKey', () => {
  it('changes when any layout input that can reflow text changes', () => {
    const base = { width: 375, fontSize: 17, lineHeight: 1.6, translation: 'BSB', comparing: false }
    const key = computeLayoutKey(base)

    expect(computeLayoutKey({ ...base, fontSize: 19 })).not.toBe(key)
    expect(computeLayoutKey({ ...base, width: 768 })).not.toBe(key)
    expect(computeLayoutKey({ ...base, lineHeight: 2.0 })).not.toBe(key)
    expect(computeLayoutKey({ ...base, translation: 'KJV' })).not.toBe(key)
    expect(computeLayoutKey({ ...base, comparing: true })).not.toBe(key)
  })

  it('is stable across sub-pixel width jitter so scrolling does not thrash', () => {
    expect(computeLayoutKey({ width: 375.2 })).toBe(computeLayoutKey({ width: 374.8 }))
  })
})

describe('hasTextAnchor', () => {
  it('accepts a verse with a non-empty char range', () => {
    expect(hasTextAnchor(highlight())).toBe(true)
  })

  it('rejects legacy rows that only carry pixels', () => {
    expect(hasTextAnchor({ verse: 16, data: { rect: { x: 0, y: 0, width: 5, height: 5 } } })).toBe(false)
  })

  it('rejects a collapsed or verse-less range', () => {
    expect(hasTextAnchor(highlight({ data: { charStart: 4, charEnd: 4 } }))).toBe(false)
    expect(hasTextAnchor(highlight({ verse: null }))).toBe(false)
  })
})

describe('locateCharOffset', () => {
  it('walks across nested spans to find the character position', () => {
    const container = buildReader([
      { number: 16, html: 'For <span class="phrase-note">God so</span> loved'  }
    ])
    const textEl = container.querySelector('.scripture-text')

    // 'For God so loved' — a range from offset 4 to 10 must cover 'God so',
    // which lives inside the nested span the phrase-note markup injects.
    // (Offset 4 sits on a node boundary; end-of-'For ' and start-of-'God so'
    // are the same DOM position, so the assertion is on the resolved range.)
    const start = locateCharOffset(textEl, 4)
    const end = locateCharOffset(textEl, 10)
    const range = document.createRange()
    range.setStart(start.node, start.offset)
    range.setEnd(end.node, end.offset)

    expect(range.toString()).toBe('God so')
  })

  it('excludes the verse number — offset 0 is the first letter of scripture', () => {
    const container = buildReader([{ number: 16, html: 'For God' }])
    const textEl = container.querySelector('.scripture-text')

    expect(locateCharOffset(textEl, 0).node.textContent.startsWith('For')).toBe(true)
  })

  it('clamps an offset past the end of the text instead of losing the anchor', () => {
    const container = buildReader([{ number: 16, html: 'For God' }])
    const textEl = container.querySelector('.scripture-text')

    const located = locateCharOffset(textEl, 999)
    expect(located.offset).toBe('For God'.length)
  })
})

describe('verseTextElement', () => {
  it('never matches a verse from another chapter', () => {
    const container = buildReader([{ number: 16, chapter: 3, html: 'For God so loved' }])
    expect(verseTextElement(container, { book: 'JHN', chapter: 4, verse: 16 })).toBeNull()
  })
})

describe('toScrollSpaceRect', () => {
  it('converts a viewport rect into the scroll space the overlay draws in', () => {
    const rect = toScrollSpaceRect(
      { left: 100, top: 200, width: 50, height: 20 },
      { left: 10, top: 40 },
      { left: 0, top: 300 }
    )
    expect(rect).toEqual({ x: 90, y: 460, width: 50, height: 20 })
  })
})

describe('resolveAnchorRects', () => {
  it('measures exactly the anchored characters', () => {
    const container = buildReader([{ number: 16, html: 'For God so loved the world' }])
    const rects = resolveAnchorRects(container, highlight({ data: { charStart: 4, charEnd: 16 } }))

    expect(capturedRanges).toContain('God so loved')
    expect(rects).toHaveLength(1)
    expect(rects[0].width).toBe('God so loved'.length)
  })

  it('resolves through the markup phrase notes inject', () => {
    const container = buildReader([
      { number: 16, html: 'For <span class="phrase-note">God so</span> loved the world' }
    ])
    resolveAnchorRects(container, highlight({ data: { charStart: 4, charEnd: 16 } }))

    expect(capturedRanges).toContain('God so loved')
  })

  it('resolves to the same words after the layout changes — the reflow guarantee', () => {
    const annotation = highlight({ data: { charStart: 4, charEnd: 16 } })

    const narrow = buildReader([{ number: 16, html: 'For God so loved the world' }], {
      rect: { left: 0, top: 0 }
    })
    resolveAnchorRects(narrow, annotation)
    const atNarrow = capturedRanges.at(-1)

    document.body.innerHTML = ''
    const wide = buildReader([{ number: 16, html: 'For God so loved the world' }], {
      rect: { left: 200, top: 0 }
    })
    resolveAnchorRects(wide, annotation)

    expect(capturedRanges.at(-1)).toBe(atNarrow)
    expect(atNarrow).toBe('God so loved')
  })

  it('offsets rects by the container scroll position', () => {
    const container = buildReader([{ number: 16, html: 'For God so loved' }], { scrollTop: 250 })
    const [rect] = resolveAnchorRects(container, highlight({ data: { charStart: 0, charEnd: 3 } }))

    // stub rect is at viewport top 200, container top 40, scrollTop 250
    expect(rect.y).toBe(200 - 40 + 250)
  })

  it('returns one rect per line for a phrase that wraps', () => {
    linesFor = () => [
      { left: 100, top: 200, width: 40, height: 20 },
      { left: 10, top: 220, width: 25, height: 20 }
    ]
    const container = buildReader([{ number: 16, html: 'For God so loved the world' }])

    expect(resolveAnchorRects(container, highlight({ data: { charStart: 0, charEnd: 20 } }))).toHaveLength(2)
  })

  it('drops zero-area rects', () => {
    linesFor = () => [
      { left: 100, top: 200, width: 0, height: 20 },
      { left: 100, top: 200, width: 30, height: 20 }
    ]
    const container = buildReader([{ number: 16, html: 'For God so loved' }])

    expect(resolveAnchorRects(container, highlight())).toHaveLength(1)
  })

  it('returns nothing when the verse is not rendered', () => {
    const container = buildReader([{ number: 1, html: 'In the beginning' }])
    expect(resolveAnchorRects(container, highlight({ verse: 16 }))).toEqual([])
  })

  it('returns nothing without a container', () => {
    expect(resolveAnchorRects(null, highlight())).toEqual([])
  })
})

describe('resolveHighlightRects', () => {
  it('produces one draw-ready band per rect, keyed uniquely but sharing a localId', () => {
    linesFor = () => [
      { left: 100, top: 200, width: 40, height: 20 },
      { left: 10, top: 220, width: 25, height: 20 }
    ]
    const container = buildReader([{ number: 16, html: 'For God so loved the world' }])

    const bands = resolveHighlightRects(container, [highlight({ localId: 7 })])

    expect(bands).toHaveLength(2)
    expect(bands.map((b) => b.key)).toEqual(['7-0', '7-1'])
    expect(new Set(bands.map((b) => b.localId))).toEqual(new Set([7]))
    expect(bands.every((b) => b.anchored)).toBe(true)
  })

  it('carries colour and opacity through, defaulting underlines to opaque', () => {
    const container = buildReader([{ number: 16, html: 'For God so loved' }])

    const [band] = resolveHighlightRects(container, [
      highlight({ type: 'underline', colour: '#ef4444', data: { charStart: 0, charEnd: 3 } })
    ])
    expect(band.colour).toBe('#ef4444')
    expect(band.opacity).toBe(1)
  })

  it('falls back to the stored rect for a legacy row with no char range', () => {
    const container = buildReader([{ number: 16, html: 'For God so loved' }])
    const legacy = {
      localId: 3,
      type: 'highlight',
      colour: '#fde68a',
      verse: 16,
      book: 'JHN',
      chapter: 3,
      data: { anchorVersion: 0, rect: { x: 12, y: 34, width: 56, height: 18 } }
    }

    const [band] = resolveHighlightRects(container, [legacy])

    expect(band.anchored).toBe(false)
    expect(band.rect).toEqual({ x: 12, y: 34, width: 56, height: 18 })
  })

  it('falls back to the stored rect when the anchored verse is not on screen', () => {
    const container = buildReader([{ number: 1, html: 'In the beginning' }])
    const offScreen = highlight({ data: { charStart: 0, charEnd: 5, rect: { x: 1, y: 2, width: 3, height: 4 } } })

    const [band] = resolveHighlightRects(container, [offScreen])
    expect(band.anchored).toBe(false)
    expect(band.rect).toEqual({ x: 1, y: 2, width: 3, height: 4 })
  })

  it('emits nothing for an anchor-less row that has no rect either', () => {
    const container = buildReader([{ number: 1, html: 'In the beginning' }])
    expect(resolveHighlightRects(container, [{ localId: 9, type: 'highlight', data: {} }])).toEqual([])
  })

  it('ignores pen and shape annotations', () => {
    const container = buildReader([{ number: 16, html: 'For God so loved' }])
    const bands = resolveHighlightRects(container, [
      { localId: 1, type: 'pen', data: { svgPath: 'M 0 0' } },
      { localId: 2, type: 'shape', data: { points: [] } }
    ])
    expect(bands).toEqual([])
  })

  it('tolerates a missing annotation list', () => {
    expect(resolveHighlightRects(null, undefined)).toEqual([])
  })
})
