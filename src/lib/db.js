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

// v2: passages/studyNotes now keyed by `source` too — but Dexie cannot change
// a table's primary key, so we drop the v1 tables and introduce new names.
// The old rows are disposable cache; nothing is lost.
db.version(2).stores({
  passages: null,
  studyNotes: null,
  passageCache: '[book+chapter+translation+source], fetchedAt',
  studyNoteCache: '[book+chapter+translation+source]'
})

// v3: savedNotes — explicitly named study notes saved by the user from the reader.
// Unlike annotations (auto-saved on every action), a savedNote is a deliberate
// user action: they tap "Save Note", give it a name, and it appears in the Notes tab.
db.version(3).stores({
  savedNotes:
    '++localId, remoteId, userId, name, passageRef, book, chapter, createdAt, updatedAt, dirty'
})

// v4: savedNotePassages — a note can now span multiple passages.
// Each row links one savedNote to one passage, allowing the user to add
// annotations from John 3, Proverbs 19, Romans 8, etc. all under one note.
// The passage-level columns (book, chapter, passageRef) move here from savedNotes;
// savedNotes keeps only the note-level metadata (name, timestamps).
db.version(4).stores({
  // Drop passage-level indexes from savedNotes — a note is no longer tied to one passage.
  savedNotes: '++localId, remoteId, userId, name, createdAt, updatedAt, dirty',
  // One row per (note × passage) pair. savedNoteLocalId is the FK to savedNotes.
  savedNotePassages:
    '++localId, savedNoteLocalId, [savedNoteLocalId+book+chapter], book, chapter, savedAt'
})

// v5: notes — user-authored scripture notes with verse/phrase anchors (PRD §5.3, §6.5).
// noteNotebook — many-to-many pivot linking notes to notebooks.
// notebooks gets isDefault flag for the auto-created Untitled Notebook.
db.version(5).stores({
  notebooks: '++localId, remoteId, userId, isDefault, title, updatedAt, dirty',
  notes:
    '++localId, remoteId, userId, book, chapter, verse, char_start, char_end, updatedAt, dirty, deletedAt',
  noteNotebook: '++localId, noteLocalId, notebookLocalId, dirty',
})

// v6: compound [book+chapter] indexes on notes and annotations to satisfy
// the queries in noteRepository.forPassage() and annotationRepository.forPassage().
db.version(6).stores({
  notes:
    '++localId, remoteId, userId, [book+chapter], book, chapter, verse, char_start, char_end, updatedAt, dirty, deletedAt',
  annotations:
    '++localId, remoteId, userId, [book+chapter], book, chapter, verse, type, isShared, shareToken, updatedAt, dirty, deletedAt',
})

export default db
