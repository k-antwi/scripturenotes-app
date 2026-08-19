import { db } from './db'

/**
 * Annotation Repository — the only thing UI components touch for
 * annotation reads/writes (PRD §4.1 step 7: "Annotation saved immediately
 * to Dexie (optimistic)").
 *
 * Every mutation also drops a row in `syncQueue` (outbox pattern), which
 * `syncService.js` drains in the background.
 */
export const AnnotationRepository = {
  /** All annotations for a chapter, excluding soft-deleted rows. */
  async forChapter(book, chapter) {
    return db.annotations
      .where({ book, chapter })
      .filter((a) => !a.deletedAt)
      .toArray()
  },

  async search({ keyword, verse, colour, type } = {}) {
    let collection = db.annotations.filter((a) => !a.deletedAt)
    if (verse) collection = collection.and((a) => a.verse === verse)
    if (colour) collection = collection.and((a) => a.colour === colour)
    if (type) collection = collection.and((a) => a.type === type)
    if (keyword) {
      const needle = keyword.toLowerCase()
      collection = collection.and((a) =>
        (a.data?.text || '').toLowerCase().includes(needle)
      )
    }
    return collection.toArray()
  },

  /**
   * Create a highlight, pen stroke, underline, shape, or typed note.
   * Shape of `data` follows PRD §8 (per-type JSON schema).
   */
  async create({ userId, book, chapter, verse, type, data, colour, isShared = false }) {
    const now = new Date().toISOString()
    const localId = await db.annotations.add({
      remoteId: null,
      userId,
      book,
      chapter,
      verse: verse ?? null,
      type,
      data,
      colour,
      isShared,
      shareToken: null,
      updatedAt: now,
      dirty: true,
      deletedAt: null
    })
    await this._enqueue('annotation', localId, 'create')
    return localId
  },

  async update(localId, changes) {
    await db.annotations.update(localId, { ...changes, updatedAt: new Date().toISOString(), dirty: true })
    await this._enqueue('annotation', localId, 'update')
  },

  /** Soft-delete only — PRD §7.2 DELETE is a soft-delete on the server too. */
  async remove(localId) {
    await db.annotations.update(localId, { deletedAt: new Date().toISOString(), dirty: true })
    await this._enqueue('annotation', localId, 'delete')
  },

  /** Tag an annotation into a notebook (many-to-many, PRD §11.1). */
  async addToNotebook(annotationLocalId, notebookLocalId) {
    const localId = await db.annotationNotebook.add({
      annotationLocalId,
      notebookLocalId,
      dirty: true
    })
    await this._enqueue('annotation_notebook', localId, 'create')
    return localId
  },

  async removeFromNotebook(pivotLocalId) {
    await db.annotationNotebook.delete(pivotLocalId)
    await this._enqueue('annotation_notebook', pivotLocalId, 'delete')
  },

  async _enqueue(entityType, entityLocalId, action) {
    await db.syncQueue.add({
      entityType,
      entityLocalId,
      action,
      createdAt: new Date().toISOString(),
      attempts: 0
    })
  }
}

export default AnnotationRepository
