/**
 * Highlight geometry — re-derives the on-screen rectangles for highlight and
 * underline annotations from their TEXT anchor, on every layout.
 *
 * A note is anchored semantically: `book / chapter / verse` plus a character
 * range measured against the verse's rendered text (see `verseSegments.js`),
 * so it lands on the same words no matter how the text reflows.
 *
 * Highlights were not. They were persisted as pixel rectangles captured from
 * the DOM Selection at the moment of drawing, in the scroll-space of whatever
 * viewport happened to be showing. Rotate the device, resize the window, cross
 * the two-column breakpoint, or change the font size / line height, and the
 * text reflows underneath a band that has not moved — the highlight drifts off
 * the words it belongs to.
 *
 * `useTextSelection.resolveSelection()` already records the same char range a
 * note uses, so the anchor was there all along; only the rendering path used
 * the stale pixels. This module closes that gap: given the live container it
 * walks back from `{verse, charStart, charEnd}` to a DOM Range and asks the
 * browser for the rectangles the text occupies *right now*.
 *
 * Every rectangle returned is in the container's scroll-space (i.e. relative
 * to the top of the scrollable content, not the viewport), which is the
 * coordinate system `AnnotationCanvas` renders and hit-tests in.
 */

/** Annotation types whose geometry follows the text. */
const TEXT_ANCHORED_TYPES = ['highlight', 'underline']

/**
 * The `.scripture-text` element for a verse inside `containerEl`.
 *
 * Char offsets are measured against `.scripture-text` (not the whole verse
 * span) so the verse number and note dot are excluded — the same element
 * `useTextSelection` measures from, so the offsets line up exactly.
 *
 * @returns {Element|null}
 */
export function verseTextElement(containerEl, { book, chapter, verse }) {
  if (!containerEl || verse == null) return null

  const verseEls = containerEl.querySelectorAll(`[data-verse="${verse}"]`)
  for (const el of verseEls) {
    // book/chapter are compared loosely: `data-chapter` is a string.
    if (book != null && el.dataset.book !== book) continue
    if (chapter != null && String(el.dataset.chapter) !== String(chapter)) continue
    return el.querySelector('.scripture-text') ?? el
  }
  return null
}

/**
 * Builds a DOM Range covering `[charStart, charEnd)` of an element's rendered
 * text, walking its text nodes so nested markup (footnote `<sup>`s, phrase-note
 * `<span>`s) is transparent — exactly how the offsets were measured.
 *
 * Returns null when the range cannot be placed (element empty, offsets past
 * the end of the text, or an inverted range).
 *
 * @returns {Range|null}
 */
export function rangeForCharRange(textEl, charStart, charEnd) {
  if (!textEl || charStart == null || charEnd == null) return null

  const start = Math.max(0, charStart)
  const end = Math.max(0, charEnd)
  if (end <= start) return null

  const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT)

  let consumed = 0
  let startNode = null
  let startOffset = 0
  let endNode = null
  let endOffset = 0

  let node = walker.nextNode()
  while (node) {
    const length = node.textContent.length

    // `<` for the start so an offset sitting on a node boundary anchors to the
    // node that actually contains the character…
    if (startNode === null && start < consumed + length) {
      startNode = node
      startOffset = start - consumed
    }
    // …and `<=` for the end so it can sit just past the last character.
    if (startNode !== null && end <= consumed + length) {
      endNode = node
      endOffset = end - consumed
      break
    }

    consumed += length
    node = walker.nextNode()
  }

  if (!startNode || !endNode) return null

  const range = document.createRange()
  range.setStart(startNode, startOffset)
  range.setEnd(endNode, endOffset)
  return range.collapsed ? null : range
}

/**
 * Live rectangles for one text anchor, in the container's scroll-space.
 *
 * A range that wraps across lines yields one rect per line box — which is the
 * whole point: after a reflow the same words may occupy one line instead of
 * three, or three instead of one, and asking the browser each time is the only
 * way to keep the band on the words.
 *
 * @returns {Array<{x: number, y: number, width: number, height: number}>}
 */
export function rectsForAnchor(containerEl, { book, chapter, verse, charStart, charEnd }) {
  const textEl = verseTextElement(containerEl, { book, chapter, verse })
  if (!textEl) return []

  const range = rangeForCharRange(textEl, charStart, charEnd)
  if (!range) return []

  const containerRect = containerEl.getBoundingClientRect()
  const scrollTop = containerEl.scrollTop ?? 0
  const scrollLeft = containerEl.scrollLeft ?? 0

  return Array.from(range.getClientRects())
    // Collapsed rects appear at line-wrap boundaries and would render as
    // invisible slivers or, for underlines, stray 2px ticks.
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => ({
      x: r.left - containerRect.left + scrollLeft,
      y: r.top - containerRect.top + scrollTop,
      width: r.width,
      height: r.height
    }))
}

/**
 * Flattens highlight/underline annotations into the boxes the canvas renders.
 *
 * Two details worth knowing:
 *
 *  - **Deduplication.** Older records were written one-row-per-line-box, all
 *    carrying the same char range. Re-deriving geometry would draw each of
 *    those rows over the same words, stacking translucent bands into a darker
 *    smear. Rows sharing an anchor are therefore collapsed into a single box
 *    set whose `localIds` lists every row, so erasing removes the whole group.
 *
 *  - **Fallback.** A record with no char range (written before the anchor was
 *    stored) keeps its persisted rect. It still drifts, but it stays visible
 *    rather than vanishing.
 *
 * @param {Element|null} containerEl  the scrollable scripture container
 * @param {Array<object>} annotations
 * @returns {Array<{key: string, localIds: Array<number>, type: string,
 *                  colour: string, opacity: number,
 *                  rect: {x: number, y: number, width: number, height: number}}>}
 */
export function buildHighlightBoxes(containerEl, annotations) {
  if (!Array.isArray(annotations)) return []

  const groups = new Map()
  for (const a of annotations) {
    if (!TEXT_ANCHORED_TYPES.includes(a?.type)) continue
    const key = anchorKey(a)
    const group = groups.get(key)
    if (group) group.localIds.push(a.localId)
    else groups.set(key, { key, annotation: a, localIds: [a.localId] })
  }

  const boxes = []
  for (const { key, annotation, localIds } of groups.values()) {
    const { charStart, charEnd } = annotation.data ?? {}
    const anchored = charStart != null && charEnd != null

    const rects = anchored
      ? rectsForAnchor(containerEl, {
        book: annotation.book,
        chapter: annotation.chapter,
        verse: annotation.verse,
        charStart,
        charEnd
      })
      : rectFallback(annotation)

    rects.forEach((rect, i) => {
      boxes.push({
        key: `${key}:${i}`,
        localIds,
        type: annotation.type,
        colour: annotation.colour,
        opacity: annotation.data?.opacity ?? (annotation.type === 'underline' ? 1 : 0.35),
        rect
      })
    })
  }

  return boxes
}

// ── Internals ────────────────────────────────────────────────────────────────

/** Identity of the words an annotation marks — rows sharing it are one mark. */
function anchorKey(a) {
  const { charStart, charEnd } = a.data ?? {}
  if (charStart == null || charEnd == null) return `unanchored:${a.localId}`
  return [a.type, a.colour, a.book, a.chapter, a.verse, charStart, charEnd].join('|')
}

function rectFallback(a) {
  const r = a.data?.rect
  if (!r || !(r.width > 0)) return []
  return [{ x: r.x, y: r.y, width: r.width, height: r.height }]
}
