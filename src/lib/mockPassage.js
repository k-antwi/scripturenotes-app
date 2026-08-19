/**
 * Small bundled fixture so the reader has something to render before a
 * Laravel backend / Bible API is wired up. Real data flows through
 * PassageRepository → PassageAPI once VITE_API_BASE_URL is configured.
 * Text: Berean Standard Bible (public domain), Proverbs 19 — matches the
 * PRD's reference screenshot passage.
 */
export const MOCK_PASSAGE = {
  book: 'PRO',
  chapter: 19,
  translation: 'BSB',
  reference: 'Proverbs 19',
  verses: [
    { number: 1, text: 'Better a poor man who walks with integrity than one who has perverse lips and is a fool.' },
    { number: 2, text: 'Even zeal is not good without knowledge, and the one who acts hastily sins.' },
    {
      number: 11,
      text: "A man's discretion gives him patience, and his glory is to overlook an offense.",
      footnotes: [{ marker: 'a', text: 'Or: A man\'s wisdom makes him slow to anger.' }]
    },
    { number: 14, text: 'Houses and wealth are inherited from fathers, but a prudent wife is from the LORD.' },
    { number: 20, text: 'Listen to counsel and receive instruction, that you may be wise in the time to come.' },
    { number: 21, text: 'Many plans are in a man\'s heart, but it is the LORD\'s purpose that will prevail.' }
  ]
}

export const MOCK_NOTES = {
  book: 'PRO',
  chapter: 19,
  translation: 'BSB',
  notes: [
    {
      verse: 11,
      heading: '19:11',
      body: 'Discretion here carries the sense of prudence or good sense. Overlooking an offense is presented as a mark of strength, not weakness — compare <ref>Proverbs 17:9</ref>.'
    }
  ]
}
