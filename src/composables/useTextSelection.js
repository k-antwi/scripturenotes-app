import { useToolStore, TOOLS } from '@/stores/tool'

/**
 * Highlighter & Underline tools (PRD §5.2): "Tap+drag to select text range".
 * Scripture is rendered as real, selectable DOM text (not canvas text) —
 * this reads the browser's native Selection, resolves it to a verse
 * element + char range, and returns the DOMRects needed to position the
 * highlight/underline band on the Konva overlay (PRD §6.4).
 *
 * Verses render inline, one after another, inside a single paragraph — so a
 * natural drag-select very often crosses a verse boundary. resolveSelection
 * therefore returns one entry PER VERSE the selection touches (clipped to
 * that verse's own text), instead of assuming the whole selection sits
 * inside a single `[data-verse]` element.
 */
export function useTextSelection(containerRef) {
  const tool = useToolStore()

  /** Call on `selectionchange` / pointerup while a text tool is active. */
  function resolveSelection() {
    if (![TOOLS.HIGHLIGHTER, TOOLS.UNDERLINE].includes(tool.activeTool)) return null

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null
    if (!containerRef.value) return null

    const range = selection.getRangeAt(0)

    // Every verse element the selection overlaps, in document order.
    const verseEls = Array.from(containerRef.value.querySelectorAll('[data-verse]'))
      .filter((el) => range.intersectsNode(el))

    if (verseEls.length === 0) {
      selection.removeAllRanges()
      return null
    }

    const containerRect = containerRef.value.getBoundingClientRect()
    const results = []

    for (const verseEl of verseEls) {
      // Clip the user's range down to just this verse's contents so a
      // selection spanning verses 1–3 produces three separate highlights,
      // each positioned/scoped to its own verse.
      const verseRange = document.createRange()
      verseRange.selectNodeContents(verseEl)

      if (range.compareBoundaryPoints(Range.START_TO_START, verseRange) > 0) {
        verseRange.setStart(range.startContainer, range.startOffset)
      }
      if (range.compareBoundaryPoints(Range.END_TO_END, verseRange) < 0) {
        verseRange.setEnd(range.endContainer, range.endOffset)
      }

      if (verseRange.collapsed) continue

      const { charStart, charEnd } = charOffsetsWithinVerse(verseEl, verseRange)
      if (charStart === charEnd) continue

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
        charStart,
        charEnd,
        rects
      })
    }

    selection.removeAllRanges()

    return results.length > 0 ? results : null
  }

  return { resolveSelection }
}

/** Walks the verse element's text content to find the Range's char offsets. */
function charOffsetsWithinVerse(verseEl, range) {
  const preStart = document.createRange()
  preStart.selectNodeContents(verseEl)
  preStart.setEnd(range.startContainer, range.startOffset)
  const charStart = preStart.toString().length

  const preEnd = document.createRange()
  preEnd.selectNodeContents(verseEl)
  preEnd.setEnd(range.endContainer, range.endOffset)
  const charEnd = preEnd.toString().length

  return { charStart, charEnd }
}
