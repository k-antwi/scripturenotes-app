import { useToolStore, TOOLS } from '@/stores/tool'

/**
 * Resolves the browser's native text Selection onto scripture verses.
 *
 * Two consumers:
 *
 *   resolveSelection()        Highlighter & Underline tools (PRD §5.2) —
 *                             "Tap+drag to select text range". Returns the
 *                             DOMRects needed to draw the band on the Konva
 *                             overlay (PRD §6.4), one entry per verse the
 *                             drag crosses.
 *
 *   resolvePhraseSelection()  Note tool (PRD §5.3) — "comment on a word or
 *                             phrase". Returns a single phrase anchor
 *                             (verse + char range + the selected words) for
 *                             the note editor to attach a note to.
 *
 * Scripture is rendered as real, selectable DOM text (not canvas text), and
 * verses render inline one after another inside a single paragraph — so a
 * natural drag-select very often crosses a verse boundary. Both resolvers
 * therefore clip the user's range to individual `[data-verse]` elements
 * rather than assuming the selection sits inside one.
 *
 * Char offsets are measured against the verse's `.scripture-text` element,
 * not the whole verse span, so they exclude the verse number and line up
 * with the rendered text that `lib/verseSegments.js` re-splits when drawing
 * phrase underlines.
 */
export function useTextSelection(containerRef) {
  const tool = useToolStore()

  /** Call on `selectionchange` / pointerup while a text tool is active. */
  function resolveSelection() {
    if (![TOOLS.HIGHLIGHTER, TOOLS.UNDERLINE].includes(tool.activeTool)) return null

    const context = readSelection(containerRef)
    if (!context) return null

    const { selection, range, verseEls, containerRect } = context
    const results = []

    for (const verseEl of verseEls) {
      const verseRange = clipRangeTo(range, verseEl)
      if (!verseRange) continue

      const offsets = charOffsetsWithinVerse(verseEl, range)
      if (!offsets) continue

      const rects = Array.from(verseRange.getClientRects()).map((r) => ({
        x: r.left - containerRect.left,
        y: r.top - containerRect.top,
        width: r.width,
        height: r.height
      }))
      if (rects.length === 0) continue

      results.push({
        book: verseEl.dataset.book,
        chapter: Number(verseEl.dataset.chapter),
        verse: Number(verseEl.dataset.verse),
        charStart: offsets.charStart,
        charEnd: offsets.charEnd,
        rects
      })
    }

    selection.removeAllRanges()

    return results.length > 0 ? results : null
  }

  /**
   * Resolves the current selection to ONE phrase anchor for the Note tool.
   *
   * A note record carries a single verse plus a char range, so a selection
   * dragged across a verse boundary is anchored to the verse it STARTS in
   * and clipped to that verse's text. `spansMultipleVerses` reports when
   * that clipping happened so the UI can say so.
   *
   * @returns {{book: string, chapter: number, verse: number,
   *            charStart: number, charEnd: number, text: string,
   *            spansMultipleVerses: boolean} | null}
   */
  function resolvePhraseSelection() {
    if (tool.activeTool !== TOOLS.NOTE) return null

    const context = readSelection(containerRef)
    if (!context) return null

    const { selection, range, verseEls } = context

    let anchor = null
    for (const verseEl of verseEls) {
      const offsets = charOffsetsWithinVerse(verseEl, range)
      if (!offsets) continue
      anchor = {
        book: verseEl.dataset.book,
        chapter: Number(verseEl.dataset.chapter),
        verse: Number(verseEl.dataset.verse),
        charStart: offsets.charStart,
        charEnd: offsets.charEnd,
        text: offsets.text,
        spansMultipleVerses: verseEls.length > 1
      }
      break
    }

    selection.removeAllRanges()

    return anchor
  }

  return { resolveSelection, resolvePhraseSelection }
}

// ── Internals ────────────────────────────────────────────────────────────────

/** Shared guard: a live, non-collapsed selection overlapping at least one verse. */
function readSelection(containerRef) {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null
  if (!containerRef.value) return null

  const range = selection.getRangeAt(0)

  const verseEls = Array.from(containerRef.value.querySelectorAll('[data-verse]'))
    .filter((el) => range.intersectsNode(el))

  if (verseEls.length === 0) {
    selection.removeAllRanges()
    return null
  }

  return {
    selection,
    range,
    verseEls,
    containerRect: containerRef.value.getBoundingClientRect()
  }
}

/**
 * Clips the user's range down to one element's contents, so a selection
 * spanning verses 1–3 produces three separate results, each scoped to its
 * own verse. Returns null when nothing of the range falls inside.
 */
function clipRangeTo(range, element) {
  const bounds = document.createRange()
  bounds.selectNodeContents(element)

  if (range.compareBoundaryPoints(Range.START_TO_START, bounds) > 0) {
    bounds.setStart(range.startContainer, range.startOffset)
  }
  if (range.compareBoundaryPoints(Range.END_TO_END, bounds) < 0) {
    bounds.setEnd(range.endContainer, range.endOffset)
  }

  return bounds.collapsed ? null : bounds
}

/**
 * Char offsets of the selection within a verse's rendered text.
 *
 * Measured against `.scripture-text` so the verse number (and the note
 * margin dot) are excluded — offset 0 is the first letter of scripture.
 */
function charOffsetsWithinVerse(verseEl, range) {
  const textEl = verseEl.querySelector('.scripture-text') ?? verseEl
  const clipped = clipRangeTo(range, textEl)
  if (!clipped) return null

  const preStart = document.createRange()
  preStart.selectNodeContents(textEl)
  preStart.setEnd(clipped.startContainer, clipped.startOffset)
  const charStart = preStart.toString().length

  const preEnd = document.createRange()
  preEnd.selectNodeContents(textEl)
  preEnd.setEnd(clipped.endContainer, clipped.endOffset)
  const charEnd = preEnd.toString().length

  if (charEnd <= charStart) return null

  return { charStart, charEnd, text: clipped.toString() }
}
