/**
 * Normalizes a raw helloao.org chapter response into the shape the rest of
 * the app already expects (the same shape PassageAPI / mockPassage use):
 *
 *   { book, chapter, translation, reference, totalChapters, verses: [
 *       { number, text, footnotes?: [{ marker, text }] }
 *   ]}
 *
 * The helloao chapter payload's `content` array mixes headings, line breaks
 * and verse entries. Each verse's own `content` array is a list of text
 * fragments that come in two shapes depending on the book genre:
 *   - Plain string:          "In the beginning God created the heavens..."
 *     (narrative books like Genesis, Exodus, etc.)
 *   - Object with text key:  { text: "These are the proverbs...", poem: 1 }
 *     (poetic books like Proverbs, Psalms, etc.)
 * Footnote-only objects like { noteId: 0 } carry no text and are skipped.
 */
export function normalizeHelloaoChapter(raw, { book, chapter, translation }) {
  const content = raw?.chapter?.content ?? []
  const footnoteById = new Map((raw?.chapter?.footnotes ?? []).map((f) => [f.noteId, f]))

  const verses = content
    .filter((item) => item.type === 'verse')
    .map((item) => {
      const parts = Array.isArray(item.content) ? item.content : []

      // Handle both content shapes the API returns:
      //   - plain string  → narrative books (Genesis, Exodus, …)
      //   - { text, … }  → poetic books (Proverbs, Psalms, …)
      // Objects that only carry { noteId } have no text and are skipped.
      const text = parts
        .filter((part) => typeof part === 'string' || (typeof part === 'object' && typeof part.text === 'string'))
        .map((part) => (typeof part === 'string' ? part : part.text))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

      const noteIds = parts
        .map((part) => part?.noteId)
        .filter((id) => id !== undefined && id !== null)

      const footnotes = noteIds
        .map((id) => footnoteById.get(id))
        .filter(Boolean)
        .map((note, idx) => ({
          marker: note.caller && note.caller !== '-' ? note.caller : String.fromCharCode(97 + idx),
          text: note.text
        }))

      return {
        number: item.number,
        text,
        ...(footnotes.length ? { footnotes } : {})
      }
    })

  return {
    book,
    chapter: Number(chapter),
    translation,
    reference: raw?.thisChapterReference
      ? `${raw.thisChapterReference.book ?? book} ${raw.thisChapterReference.chapter ?? chapter}`
      : `${book} ${chapter}`,
    totalChapters: raw?.book?.numberOfChapters,
    verses
  }
}

export default normalizeHelloaoChapter
