import Dexie from 'dexie'

/**
 * Offline-First Repository Pattern (PRD §4.1).
 * UI components never talk to the network directly — they read/write here.
 * A background sync layer (see syncService.js) reconciles with Laravel.
 *
 * Table shapes mirror the server schema in PRD §4.2, minus columns the
 * client doesn't need to index on.
 */
export const db = new Dexie('bible_study')

db.version(1).stores({
  // Cache of API responses; keyed by book+chapter+translation
  passages: '[book+chapter+translation], fetchedAt',

  // Study notes per chapter (ESV Global SB / user-added), cached alongside passages
  studyNotes: '[book+chapter+translation]',

  // Polymorphic annotation record. `dirty` flags rows the outbox hasn't pushed yet.
  annotations:
    '++localId, remoteId, userId, book, chapter, verse, type, isShared, shareToken, updatedAt, dirty, deletedAt',

  // User-created collections, e.g. 'Sunday Sermon Prep'
  notebooks: '++localId, remoteId, userId, title, updatedAt, dirty',

  // Many-to-many: an annotation can sit in zero, one, or several notebooks
  annotationNotebook: '++localId, annotationLocalId, notebookLocalId, dirty',

  // User-authored commentary, independent of any third-party dataset
  customNotes: '++localId, remoteId, userId, book, chapter, verse, updatedAt, dirty',

  bookmarks: '++localId, remoteId, userId, book, chapter, verse, updatedAt, dirty',

  studySessions: '++localId, remoteId, userId, startedAt, lastActiveAt, passageRef',

  // Outbox pattern — every offline mutation lands here until synced (PRD §9 Data Integrity)
  syncQueue: '++id, entityType, entityLocalId, action, createdAt, attempts'
})

// v2: passages/studyNotes are now also keyed by `source` (laravel | freeuse)
// so switching Bible sources (PRD §11.5 / frontend source toggle) never
// serves cached text fetched from the other backend under the same
// book+chapter+translation combination. Old v1 rows are simply superseded —
// they're disposable cache, not user data — so no upgrade() migration is needed.
db.version(2).stores({
  passages: '[book+chapter+translation+source], fetchedAt',
  studyNotes: '[book+chapter+translation+source]'
})

export default db
