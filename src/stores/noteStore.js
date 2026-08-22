import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { db } from '@/lib/db'
import { NoteRepository } from '@/lib/noteRepository'
import { NoteAPI } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

export const useNoteStore = defineStore('notes', () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const passageNotes = ref([])   // notes for the currently-open passage
  const activeNote = ref(null)   // note shown in the popup
  const notebooks = ref([])

  // ── Actions ────────────────────────────────────────────────────────────────

  async function loadForPassage(book, chapter) {
    passageNotes.value = await NoteRepository.forPassage(book, chapter)
  }

  async function saveNote({ book, chapter, verse, charStart, charEnd, title, body, notebookLocalIds = [] }) {
    const auth = useAuthStore()

    // If no notebooks selected, find (or create) the local Untitled Notebook
    let ids = notebookLocalIds
    if (!ids.length) {
      const defaultNb = await db.notebooks.where({ isDefault: 1 }).first()
      if (defaultNb) ids = [defaultNb.localId]
    }

    const localId = await NoteRepository.save({
      userId: auth.user?.id ?? 'local',
      book, chapter, verse, charStart, charEnd, title, body,
      notebookLocalIds: ids,
    })

    // Optimistic push
    try {
      const remote = await NoteAPI.create({
        book, chapter, verse, char_start: charStart, char_end: charEnd, title, body,
        notebook_ids: await _resolveRemoteNotebookIds(ids),
      })
      await db.notes.update(localId, { remoteId: remote.data.id, dirty: false })
      await db.syncQueue.where({ entityType: 'note', entityLocalId: localId }).delete()
    } catch {
      // Offline — syncService will retry
    }

    await loadForPassage(book, chapter)
    return localId
  }

  async function updateNote(localId, changes) {
    await NoteRepository.update(localId, changes)
    const note = await db.notes.get(localId)
    if (note?.remoteId) {
      try {
        await NoteAPI.update(note.remoteId, _toApiPayload(changes))
        await db.notes.update(localId, { dirty: false })
        await db.syncQueue.where({ entityType: 'note', entityLocalId: localId }).delete()
      } catch {
        // Will sync later
      }
    }
    if (note?.book && note?.chapter) await loadForPassage(note.book, note.chapter)
  }

  async function deleteNote(localId) {
    const note = await db.notes.get(localId)
    await NoteRepository.softDelete(localId)
    if (note?.remoteId) {
      try {
        await NoteAPI.destroy(note.remoteId)
        await db.syncQueue.where({ entityType: 'note', entityLocalId: localId }).delete()
      } catch {
        // Will sync later
      }
    }
    if (note?.book && note?.chapter) await loadForPassage(note.book, note.chapter)
    if (activeNote.value?.localId === localId) activeNote.value = null
  }

  async function loadNotebooks() {
    notebooks.value = await db.notebooks.orderBy('title').toArray()
  }

  async function createNotebook(title) {
    const auth = useAuthStore()
    const localId = await db.notebooks.add({
      remoteId: null,
      userId: auth.user?.id ?? 'local',
      isDefault: 0,
      title: title.trim(),
      updatedAt: new Date().toISOString(),
      dirty: true,
    })
    await db.syncQueue.add({
      entityType: 'notebook',
      entityLocalId: localId,
      action: 'create',
      createdAt: new Date().toISOString(),
      attempts: 0,
    })
    await loadNotebooks()
    return db.notebooks.get(localId)
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  const notesByVerse = computed(() => {
    const map = {}
    for (const n of passageNotes.value) {
      if (!n.book) continue  // standalone
      const v = n.verse
      if (v == null) continue
      if (!map[v]) map[v] = []
      map[v].push(n)
    }
    return map
  })

  const notesByCharRange = computed(() =>
    passageNotes.value.filter((n) => n.char_start != null && n.char_end != null)
  )

  /** Whole-verse notes (no char range) — these drive the margin dot. */
  const verseNotesByVerse = computed(() => groupByVerse(passageNotes.value, false))

  /**
   * Phrase-anchored notes (char range present) — these are underlined in
   * place inside the verse text (PRD §5.3).
   */
  const phraseNotesByVerse = computed(() => groupByVerse(passageNotes.value, true))

  // ── Internals ──────────────────────────────────────────────────────────────

  function groupByVerse(notes, wantPhraseNotes) {
    const map = {}
    for (const note of notes) {
      if (!note.book) continue  // standalone
      if (note.verse == null) continue
      const isPhraseNote = note.char_start != null && note.char_end != null
      if (isPhraseNote !== wantPhraseNotes) continue
      if (!map[note.verse]) map[note.verse] = []
      map[note.verse].push(note)
    }
    return map
  }

  async function _resolveRemoteNotebookIds(localIds) {
    const rows = await db.notebooks.where('localId').anyOf(localIds).toArray()
    return rows.filter((r) => r.remoteId).map((r) => r.remoteId)
  }

  function _toApiPayload(changes) {
    const out = {}
    if ('title' in changes) out.title = changes.title
    if ('body' in changes) out.body = changes.body
    if ('book' in changes) out.book = changes.book
    if ('chapter' in changes) out.chapter = changes.chapter
    if ('verse' in changes) out.verse = changes.verse
    if ('charStart' in changes) out.char_start = changes.charStart
    if ('charEnd' in changes) out.char_end = changes.charEnd
    return out
  }

  return {
    passageNotes, activeNote, notebooks,
    loadForPassage, saveNote, updateNote, deleteNote,
    loadNotebooks, createNotebook,
    notesByVerse, notesByCharRange, verseNotesByVerse, phraseNotesByVerse,
  }
})
