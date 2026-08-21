import { db } from './db'

/**
 * Note Repository — offline-first CRUD for user-authored scripture notes.
 * Follows the same outbox pattern as annotationRepository.js (PRD §4.1).
 */
export const NoteRepository = {
  /** All notes for a passage (excludes soft-deleted rows). */
  async forPassage(book, chapter) {
    return db.notes
      .where({ book: book.toUpperCase(), chapter })
      .filter((n) => !n.deletedAt)
      .toArray()
  },

  /** All notes in a notebook (by localId). */
  async forNotebook(notebookLocalId) {
    const pivots = await db.noteNotebook.where({ notebookLocalId }).toArray()
    const ids = pivots.map((p) => p.noteLocalId)
    if (!ids.length) return []
    return db.notes
      .where('localId')
      .anyOf(ids)
      .filter((n) => !n.deletedAt)
      .toArray()
  },

  async getById(localId) {
    return db.notes.get(localId)
  },

  async save({ userId, book, chapter, verse, charStart, charEnd, title, body, notebookLocalIds = [] }) {
    const now = new Date().toISOString()
    const localId = await db.notes.add({
      remoteId: null,
      userId,
      book: book ? book.toUpperCase() : null,
      chapter: chapter ?? null,
      verse: verse ?? null,
      char_start: charStart ?? null,
      char_end: charEnd ?? null,
      title: title ?? null,
      body,
      updatedAt: now,
      dirty: true,
      deletedAt: null,
    })

    for (const notebookLocalId of notebookLocalIds) {
      const exists = await db.noteNotebook.where({ noteLocalId: localId, notebookLocalId }).first()
      if (!exists) {
        await db.noteNotebook.add({ noteLocalId: localId, notebookLocalId, dirty: true })
      }
    }

    await this._enqueue(localId, 'create')
    return localId
  },

  async update(localId, changes) {
    const mapped = {}
    if ('title' in changes) mapped.title = changes.title
    if ('body' in changes) mapped.body = changes.body
    if ('book' in changes) mapped.book = changes.book ? changes.book.toUpperCase() : null
    if ('chapter' in changes) mapped.chapter = changes.chapter ?? null
    if ('verse' in changes) mapped.verse = changes.verse ?? null
    if ('charStart' in changes) mapped.char_start = changes.charStart ?? null
    if ('charEnd' in changes) mapped.char_end = changes.charEnd ?? null

    await db.notes.update(localId, { ...mapped, updatedAt: new Date().toISOString(), dirty: true })
    await this._enqueue(localId, 'update')
  },

  async softDelete(localId) {
    await db.notes.update(localId, { deletedAt: new Date().toISOString(), dirty: true })
    await this._enqueue(localId, 'delete')
  },

  async addToNotebook(noteLocalId, notebookLocalId) {
    const exists = await db.noteNotebook.where({ noteLocalId, notebookLocalId }).first()
    if (exists) return
    await db.noteNotebook.add({ noteLocalId, notebookLocalId, dirty: true })
  },

  async removeFromNotebook(noteLocalId, notebookLocalId) {
    await db.noteNotebook.where({ noteLocalId, notebookLocalId }).delete()
  },

  async _enqueue(entityLocalId, action) {
    await db.syncQueue.add({
      entityType: 'note',
      entityLocalId,
      action,
      createdAt: new Date().toISOString(),
      attempts: 0,
    })
  },
}

export default NoteRepository
