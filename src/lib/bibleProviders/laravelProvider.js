import { PassageAPI } from '@/lib/api'

/**
 * Default provider — proxies through the Laravel Bible service (PRD §7.3).
 * Response shape already matches what the reader expects, so no
 * normalization is needed here.
 */
export const laravelProvider = {
  id: 'laravel',
  label: 'Laravel Bible Service',

  async getPassage(book, chapter, translation) {
    const { data } = await PassageAPI.get(book, chapter, translation)
    return data
  },

  async getNotes(book, chapter, translation) {
    const { data } = await PassageAPI.notes(book, chapter, translation)
    return data
  }
}

export default laravelProvider
