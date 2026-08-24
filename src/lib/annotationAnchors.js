/**
 * Text-anchored annotations (PRD §5.2, §6.4).
 *
 * Highlights and underlines used to be stored as pixel rects in the
 * reader's scroll space. That made them layout-dependent: change the font
 * size, rotate the device, or open translation comparison, and every band
 * stayed where it was drawn while the words moved out from under it.
 *
 * They are now stored the way phrase-anchored notes always were — as a
 * verse plus a character range over that verse's RENDERED text (the same
 * offsets `useTextSelection` measures and `lib/verseSegments.js` re-splits).
 * Pixels become a derived cache: this module rebuilds them from the live
 * DOM whenever the layout key changes.
 *
 * Nothing here mutates the DOM or touches Dexie — it is pure measurement,
 * so the reader can call it from a watcher and unit tests can drive it with
 * a synthetic document.
 */

/** Bumped when the meaning of a stored anchor changes. 0 = pre-anchor row. */
export const ANCHOR_VERSION = 1

const ANCHORABLE_TYPES = ['highlight', 'underline']

/**
 * Identity of the current layout. Any change here invalidates every cached
 * rect, because any of these can reflow the text under an anchor.
 *
 * @returns {string}
 */
export function computeLayoutKey({
  width = 0,
  fontSize = 0,
  lineHeight = 0,
  translation = '',
  comparing = false
} = {}) {
  return [Math.round(width), fontSize, lineHeight, translation, comparing ? 'cmp' : 'single'].join('|')
}

/** True when the annotation carries a usable verse + char range. */
export function hasTextAnchor(annotation) {
  const data = annotation?.data
  return (
    annotation?.verse != null &&
    typeof data?.charStart === 'number' &&
    typeof data?.charEnd === 'number' &&
    data.charEnd > data.charStart
  )
}

/**
 * The `.scripture-text` element for one verse inside the reader column.
 *
 * Scoped to `containerEl` and matched on book + chapter as well as verse so
 * the comparison column never satisfies a primary-column anchor.
 */
export function verseTextElement(containerEl, { book, chapter, verse }) {
  if (!containerEl) return null
  const selector =
    `[data-verse="${verse}"]` +
    (book != null ? `[data-book="${book}"]` : '') +
    (chapter != null ? `[data-chapter="${chapter}"]` : '')
  const verseEl = containerEl.querySelector(selector)
  if (!verseEl) return null
  return verseEl.querySelector('.scripture-text') ?? verseEl
}

/**
 * Maps a character offset in an element's rendered text onto the DOM
 * position (`text node` + offset within it) a Range can be built from.
 *
 * This is the inverse of the measurement `useTextSelection` does when a
 * selection is first resolved, so a round-trip through storage lands on
 * exactly the characters the user dragged over.
 *
 * @returns {{ node: Text, offset: number } | null}
 */
export function locateCharOffset(textEl, charOffset) {
  if (!textEl || typeof charOffset !== 'number' || charOffset < 0) return null

  const walker = textEl.ownerDocument.createTreeWalker(textEl, NodeFilter.SHOW_TEXT)
  let consumed = 0
  let lastNode = null

  let node = walker.nextNode()
  while (node) {
    const length = node.textContent.length
    if (charOffset <= consumed + length) {
      return { node, offset: charOffset - consumed }
    }
    consumed += length
    lastNode = node
    node = walker.nextNode()
  }

  // Offset past the end of the rendered text — clamp to the final character
  // rather than dropping the annotation entirely.
  if (lastNode) return { node: lastNode, offset: lastNode.textContent.length }
  return null
}

/** Viewport rect → the reader's scroll space (what the overlay is drawn in). */
export function toScrollSpaceRect(domRect, containerRect, scroll = { left: 0, top: 0 }) {
  return {
    x: domRect.left - containerRect.left + (scroll.left ?? 0),
    y: domRect.top - containerRect.top + (scroll.top ?? 0),
    width: domRect.width,
    height: domRect.height
  }
}

/**
 * Measures one anchored annotation against the live DOM.
 *
 * A phrase that wraps across a line break produces several rects — one per
 * line — which is why this returns an array rather than a single rect. That
 * is also why the annotation is ONE row: the line split is a fact about the
 * current layout, not about the annotation.
 *
 * @returns {Array<{x: number, y: number, width: number, height: number}>}
 */
export function resolveAnchorRects(containerEl, annotation) {
  if (!containerEl || !hasTextAnchor(annotation)) return []

  const textEl = verseTextElement(containerEl, {
    book: annotation.book,
    chapter: annotation.chapter,
    verse: annotation.verse
  })
  if (!textEl) return []

  const start = locateCharOffset(textEl, annotation.data.charStart)
  const end = locateCharOffset(textEl, annotation.data.charEnd)
  if (!start || !end) return []

  const range = textEl.ownerDocument.createRange()
  try {
    range.setStart(start.node, start.offset)
    range.setEnd(end.node, end.offset)
  } catch {
    return []
  }
  if (range.collapsed) return []

  const containerRect = containerEl.getBoundingClientRect()
  const scroll = { left: containerEl.scrollLeft ?? 0, top: containerEl.scrollTop ?? 0 }

  return Array.from(range.getClientRects())
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => toScrollSpaceRect(rect, containerRect, scroll))
}

/**
 * Flattens every highlight/underline into the draw list the overlay renders.
 *
 * Anchored rows are measured from the DOM. Rows written before the anchor
 * migration — and rows whose verse is not currently rendered — fall back to
 * their stored rect so nothing silently disappears.
 *
 * @returns {Array<{key: string, localId: number|string, type: string,
 *                  colour: string, opacity: number, anchored: boolean,
 *                  rect: {x: number, y: number, width: number, height: number}}>}
 */
export function resolveHighlightRects(containerEl, annotations) {
  if (!Array.isArray(annotations)) return []

  const resolved = []

  for (const annotation of annotations) {
    if (!ANCHORABLE_TYPES.includes(annotation?.type)) continue

    const data = annotation.data ?? {}
    const opacity = data.opacity ?? (annotation.type === 'highlight' ? 0.35 : 1)

    let rects = resolveAnchorRects(containerEl, annotation)
    let anchored = rects.length > 0

    if (!anchored && data.rect) {
      rects = [data.rect]
    }

    rects.forEach((rect, index) => {
      resolved.push({
        key: `${annotation.localId}-${index}`,
        localId: annotation.localId,
        type: annotation.type,
        colour: annotation.colour,
        opacity,
        anchored,
        rect
      })
    })
  }

  return resolved
}
