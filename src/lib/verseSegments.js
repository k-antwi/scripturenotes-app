/**
 * Verse text segmentation (PRD §5.1.1 footnotes, §5.3 phrase-anchored notes).
 *
 * A verse is stored as raw text containing inline footnote markers like
 * `[a]` or `[1]`. The reader renders that raw text as HTML so it can:
 *
 *   1. turn each marker into a styled <sup>, and
 *   2. underline the exact words a phrase-anchored note was written about.
 *
 * Every offset in this module refers to the verse's RENDERED text — the
 * characters the reader actually sees and can select inside
 * `.scripture-text`. A `[a]` marker renders as the single character `a`,
 * so rendered offsets are exactly what `useTextSelection` measures from a
 * DOM Selection and what `char_start` / `char_end` hold on a note record.
 */

const MARKER_PATTERN = /\[([a-z0-9])\]/gi

/**
 * Splits raw verse text into text and footnote-marker tokens.
 *
 * @param {string} rawText
 * @returns {Array<{ type: 'text'|'marker', text: string }>}
 */
export function tokenizeVerseText(rawText) {
  const source = rawText ?? ''
  const tokens = []
  let lastIndex = 0

  MARKER_PATTERN.lastIndex = 0
  let match
  while ((match = MARKER_PATTERN.exec(source)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', text: source.slice(lastIndex, match.index) })
    }
    tokens.push({ type: 'marker', text: match[1] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < source.length) {
    tokens.push({ type: 'text', text: source.slice(lastIndex) })
  }

  return tokens
}

/** The plain text a reader sees for this verse (markers reduced to one char). */
export function renderedVerseText(rawText) {
  return tokenizeVerseText(rawText).map((token) => token.text).join('')
}

/**
 * The words a phrase-anchored note points at, resolved from its offsets.
 * Returns null when the range is missing or falls outside the verse.
 *
 * @param {string} rawText
 * @param {number|null} charStart
 * @param {number|null} charEnd
 * @returns {string|null}
 */
export function extractPhrase(rawText, charStart, charEnd) {
  if (charStart == null || charEnd == null) return null
  const rendered = renderedVerseText(rawText)
  const start = Math.max(0, Math.min(charStart, rendered.length))
  const end = Math.max(0, Math.min(charEnd, rendered.length))
  if (end <= start) return null
  return rendered.slice(start, end).trim() || null
}

/**
 * Renders a verse to HTML, wrapping every phrase-anchored note range in a
 * tappable, dotted-underlined span.
 *
 * Overlapping ranges are handled by grouping characters that share the
 * same set of owning notes, so two notes on overlapping phrases each keep
 * a tappable region rather than one silently winning.
 *
 * @param {string} rawText
 * @param {Array<{ charStart: number, charEnd: number, noteLocalId: number|string }>} phraseRanges
 * @returns {string} HTML safe to pass to v-html
 */
export function buildVerseHtml(rawText, phraseRanges = []) {
  const tokens = tokenizeVerseText(rawText)
  const rendered = tokens.map((token) => token.text).join('')

  // owners[i] = array of note ids covering rendered character i
  const owners = Array.from({ length: rendered.length }, () => [])
  for (const range of phraseRanges ?? []) {
    if (range?.charStart == null || range?.charEnd == null) continue
    const start = Math.max(0, Math.min(range.charStart, rendered.length))
    const end = Math.max(0, Math.min(range.charEnd, rendered.length))
    for (let i = start; i < end; i += 1) owners[i].push(range.noteLocalId)
  }

  let html = ''
  let cursor = 0

  for (const token of tokens) {
    const tokenStart = cursor
    cursor += token.text.length

    if (token.type === 'marker') {
      html += wrapWithNotes(footnoteMarkerHtml(token.text), owners[tokenStart] ?? [])
      continue
    }

    // Split the text token wherever its owning-note set changes.
    let segmentStart = 0
    for (let i = 1; i <= token.text.length; i += 1) {
      const previousKey = ownersKey(owners[tokenStart + i - 1])
      const currentKey = i === token.text.length ? null : ownersKey(owners[tokenStart + i])
      if (currentKey === previousKey) continue

      html += wrapWithNotes(
        escapeHtml(token.text.slice(segmentStart, i)),
        owners[tokenStart + segmentStart] ?? []
      )
      segmentStart = i
    }
  }

  return html
}

// ── Internals ────────────────────────────────────────────────────────────────

function ownersKey(ids) {
  return (ids ?? []).join(',')
}

function footnoteMarkerHtml(marker) {
  const safe = escapeHtml(marker)
  return `<sup class="footnote-marker cursor-pointer text-accent opacity-80" data-marker="${safe}">${safe}</sup>`
}

function wrapWithNotes(innerHtml, ids) {
  if (!innerHtml) return ''
  if (!ids.length) return innerHtml
  // The first id owns the tap target; the rest ride along in data-note-ids so
  // the reader can offer every overlapping note.
  return (
    `<span class="phrase-note" role="button" tabindex="0"` +
    ` data-note-id="${escapeHtml(String(ids[0]))}"` +
    ` data-note-ids="${escapeHtml(ids.join(','))}">${innerHtml}</span>`
  )
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
