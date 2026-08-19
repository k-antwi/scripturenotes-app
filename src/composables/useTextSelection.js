import { useToolStore, TOOLS } from '@/stores/tool'

/**
 * Highlighter & Underline tools (PRD §5.2): "Tap+drag to select text range".
 * Scripture is rendered as real, selectable DOM text (not canvas text) —
 * this reads the browser's native Selection, resolves it to a verse
 * element + char range, and returns the DOMRects needed to position the
 * highlight/underline band on the Konva overlay (PRD §6.4).
 */
export function useTextSelection(containerRef) {
  const tool = useToolStore()

  /** Call on `selectionchange` / pointerup while a text tool is active. */
  function resolveSelection() {
    if (![TOOLS.HIGHLIGHTER, TOOLS.UNDERLINE].includes(tool.activeTool)) return null

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null

    const range = selection.getRangeAt(0)
    const verseEl = closestVerseEl(range.commonAncestorContainer)
    if (!verseEl || !containerRef.value?.contains(verseEl)) return null

    const { charStart, charEnd } = charOffsetsWithinVerse(verseEl, range)
    if (charStart === charEnd) return null

    const containerRect = containerRef.value.getBoundingClientRect()
    const rects = Array.from(range.getClientRects()).map((r) => ({
      x: r.left - containerRect.left,
      y: r.top - containerRect.top,
      width: r.width,
      height: r.height
    }))

    selection.removeAllRanges()

    return {
      book: verseEl.dataset.book,
      chapter: Number(verseEl.dataset.chapter),
      verse: Number(verseEl.dataset.verse),
      charStart,
      charEnd,
      rects
    }
  }

  return { resolveSelection }
}

function closestVerseEl(node) {
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node
  return el?.closest('[data-verse]') ?? null
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
