import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUndoRedoStore } from '@/stores/undoRedo'

// Mock Dexie db so tests never touch IndexedDB
vi.mock('@/lib/db', () => ({
  db: {
    annotations: {
      update: vi.fn().mockResolvedValue(undefined)
    },
    syncQueue: {
      add: vi.fn().mockResolvedValue(undefined)
    }
  }
}))

import { db } from '@/lib/db'

describe('useUndoRedoStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('starts empty with canUndo = false and canRedo = false', () => {
    const store = useUndoRedoStore()
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(false)
  })

  it('recordCreate pushes to past and clears future', () => {
    const store = useUndoRedoStore()
    store.future = [{ op: 'create', localId: 99 }]

    store.recordCreate(1)

    expect(store.past).toHaveLength(1)
    expect(store.past[0]).toEqual({ op: 'create', localId: 1 })
    expect(store.future).toHaveLength(0)
    expect(store.canUndo).toBe(true)
  })

  it('recordRemove pushes to past and clears future', () => {
    const store = useUndoRedoStore()
    store.recordRemove(5)

    expect(store.past[0]).toEqual({ op: 'remove', localId: 5 })
    expect(store.canUndo).toBe(true)
  })

  it('undo on empty stack is a no-op', async () => {
    const store = useUndoRedoStore()
    await store.undo()
    expect(db.annotations.update).not.toHaveBeenCalled()
  })

  it('undo after recordCreate soft-deletes the annotation', async () => {
    const store = useUndoRedoStore()
    store.recordCreate(10)

    await store.undo()

    expect(db.annotations.update).toHaveBeenCalledWith(10, expect.objectContaining({
      deletedAt: expect.any(String),
      dirty: true
    }))
    expect(db.syncQueue.add).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'annotation',
      entityLocalId: 10,
      action: 'delete'
    }))

    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(true)
  })

  it('undo after recordRemove restores the annotation', async () => {
    const store = useUndoRedoStore()
    store.recordRemove(7)

    await store.undo()

    expect(db.annotations.update).toHaveBeenCalledWith(7, expect.objectContaining({
      deletedAt: null,
      dirty: true
    }))
    expect(db.syncQueue.add).toHaveBeenCalledWith(expect.objectContaining({
      action: 'update'
    }))
  })

  it('redo after undo of create restores the annotation', async () => {
    const store = useUndoRedoStore()
    store.recordCreate(3)
    await store.undo()
    vi.clearAllMocks()

    await store.redo()

    expect(db.annotations.update).toHaveBeenCalledWith(3, expect.objectContaining({
      deletedAt: null,
      dirty: true
    }))
    expect(store.canRedo).toBe(false)
    expect(store.canUndo).toBe(true)
  })

  it('redo on empty future is a no-op', async () => {
    const store = useUndoRedoStore()
    await store.redo()
    expect(db.annotations.update).not.toHaveBeenCalled()
  })

  it('clear empties both stacks', () => {
    const store = useUndoRedoStore()
    store.recordCreate(1)
    store.recordCreate(2)
    store.clear()
    expect(store.past).toHaveLength(0)
    expect(store.future).toHaveLength(0)
  })
})
