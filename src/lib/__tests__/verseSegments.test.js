/**
 * Tests for verse text segmentation — footnote markers plus the
 * phrase-anchored note underlines added for PRD §5.3.
 *
 * Run with:  npx vitest run src/lib/__tests__/verseSegments.test.js
 */
import { describe, it, expect } from 'vitest'
import {
  tokenizeVerseText,
  renderedVerseText,
  extractPhrase,
  buildVerseHtml,
} from '../verseSegments'

const VERSE_TEXT = 'In the beginning God created the heavens and the earth.'

describe('tokenizeVerseText', () => {
  it('returns a single text token when there are no markers', () => {
    expect(tokenizeVerseText(VERSE_TEXT)).toEqual([{ type: 'text', text: VERSE_TEXT }])
  })

  it('splits footnote markers out of the surrounding text', () => {
    expect(tokenizeVerseText('God created[a] the earth')).toEqual([
      { type: 'text', text: 'God created' },
      { type: 'marker', text: 'a' },
      { type: 'text', text: ' the earth' },
    ])
  })

  it('handles an empty or missing verse without throwing', () => {
    expect(tokenizeVerseText('')).toEqual([])
    expect(tokenizeVerseText(undefined)).toEqual([])
  })
})

describe('renderedVerseText', () => {
  it('reduces a [a] marker to the single character a reader sees', () => {
    expect(renderedVerseText('God created[a] the earth')).toBe('God createda the earth')
  })
})

describe('extractPhrase', () => {
  it('returns the words inside the char range', () => {
    expect(extractPhrase(VERSE_TEXT, 0, 16)).toBe('In the beginning')
    expect(extractPhrase(VERSE_TEXT, 17, 20)).toBe('God')
  })

  it('clamps a range that runs past the end of the verse', () => {
    expect(extractPhrase(VERSE_TEXT, 44, 999)).toBe('the earth.')
  })

  it('returns null for a missing, empty, or whitespace-only range', () => {
    expect(extractPhrase(VERSE_TEXT, null, 10)).toBeNull()
    expect(extractPhrase(VERSE_TEXT, 10, null)).toBeNull()
    expect(extractPhrase(VERSE_TEXT, 10, 10)).toBeNull()
    expect(extractPhrase(VERSE_TEXT, 20, 10)).toBeNull()
    expect(extractPhrase('one two', 3, 4)).toBeNull()  // just the space
  })
})

describe('buildVerseHtml', () => {
  it('renders plain text unchanged when there are no notes or markers', () => {
    expect(buildVerseHtml(VERSE_TEXT)).toBe(VERSE_TEXT)
  })

  it('renders footnote markers as sup elements', () => {
    expect(buildVerseHtml('God created[a] earth')).toBe(
      'God created' +
      '<sup class="footnote-marker cursor-pointer text-accent opacity-80" data-marker="a">a</sup>' +
      ' earth'
    )
  })

  it('wraps a phrase-note range in a tappable span and leaves the rest alone', () => {
    const html = buildVerseHtml(VERSE_TEXT, [
      { charStart: 0, charEnd: 16, noteLocalId: 7 },
    ])

    expect(html).toContain('data-note-id="7"')
    expect(html).toContain('>In the beginning</span>')
    expect(html).toContain(' God created the heavens and the earth.')
    // Only the selected words are wrapped
    expect(html.match(/<span class="phrase-note"/g)).toHaveLength(1)
  })

  it('keeps both notes tappable where two phrase ranges overlap', () => {
    const html = buildVerseHtml(VERSE_TEXT, [
      { charStart: 0, charEnd: 16, noteLocalId: 1 },
      { charStart: 7, charEnd: 20, noteLocalId: 2 },
    ])

    // Three regions: 1 only, 1+2, 2 only
    expect(html.match(/<span class="phrase-note"/g)).toHaveLength(3)
    expect(html).toContain('data-note-ids="1"')
    expect(html).toContain('data-note-ids="1,2"')
    expect(html).toContain('data-note-ids="2"')
  })

  it('underlines a footnote marker that falls inside a phrase range', () => {
    const html = buildVerseHtml('God created[a] earth', [
      { charStart: 0, charEnd: 12, noteLocalId: 4 },
    ])
    expect(html).toContain('data-note-ids="4"><sup class="footnote-marker')
  })

  it('clamps ranges that overrun the verse and ignores incomplete ones', () => {
    const html = buildVerseHtml('short', [
      { charStart: 2, charEnd: 999, noteLocalId: 9 },
      { charStart: null, charEnd: 3, noteLocalId: 10 },
    ])
    expect(html).toBe('sh<span class="phrase-note" role="button" tabindex="0" data-note-id="9" data-note-ids="9">ort</span>')
  })

  it('escapes HTML in the verse text so scripture can never inject markup', () => {
    expect(buildVerseHtml('a < b & "c"')).toBe('a &lt; b &amp; &quot;c&quot;')
  })
})
