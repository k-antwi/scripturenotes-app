import { ref, onMounted, onUnmounted, isRef, unref, watch } from 'vue'

/**
 * Subscribes to a Dexie `liveQuery()` observable and keeps a Vue ref in
 * sync — so any view reading annotations/notebooks/bookmarks re-renders
 * automatically the instant Dexie changes (including from the sync
 * service running in the background).
 *
 * @param {() => import('dexie').Observable} factory - returns a fresh liveQuery each call
 * @param {*} initialValue
 * @param {import('vue').Ref|Array} deps - re-subscribe when these change
 */
export function useObservable(factory, initialValue, deps = []) {
  const state = ref(initialValue)
  let subscription

  function subscribe() {
    subscription?.unsubscribe()
    subscription = factory().subscribe({
      next: (value) => (state.value = value),
      error: (err) => console.error('[useObservable]', err)
    })
  }

  onMounted(subscribe)
  onUnmounted(() => subscription?.unsubscribe())

  const depRefs = Array.isArray(deps) ? deps : [deps]
  if (depRefs.some(isRef)) {
    watch(
      depRefs.map((d) => (isRef(d) ? d : () => unref(d))),
      subscribe
    )
  }

  return state
}
