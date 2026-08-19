import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/',
    redirect: '/read/PRO/19'
  },
  {
    // Book/Chapter picker → passage reader (PRD §5.1.1)
    path: '/read/:book/:chapter',
    name: 'reader',
    component: () => import('@/views/ReaderView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/picker',
    name: 'book-picker',
    component: () => import('@/views/BookPickerView.vue')
  },
  {
    // 'My Annotations' — searchable by keyword, verse, colour, type (PRD §5.5)
    path: '/annotations',
    name: 'annotations',
    component: () => import('@/views/AnnotationsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/notebooks',
    name: 'notebooks',
    component: () => import('@/views/NotebooksView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/notebooks/:id',
    name: 'notebook-detail',
    component: () => import('@/views/NotebookDetailView.vue'),
    meta: { requiresAuth: true }
  },
  {
    // Reading/study session history (PRD §5.5)
    path: '/history',
    name: 'history',
    component: () => import('@/views/HistoryView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/bookmarks',
    name: 'bookmarks',
    component: () => import('@/views/BookmarksView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue')
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/AuthLoginView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/AuthRegisterView.vue'),
    meta: { requiresAuth: false }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

// Reading scripture never requires auth; only user-owned data does.
// Guests can still read + annotate locally (Dexie), sync kicks in on login.
router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  return true
})

export default router
