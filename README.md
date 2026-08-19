# Bible Study — Mobile App

Vue 3 + Capacitor mobile app built to the **Bible Study Annotation App PRD v1.1**.

## Tech stack (PRD §3)

| Layer | Technology |
|---|---|
| Web frontend | Vue 3, Vite, Tailwind CSS, Shadcn-vue (reka-ui) |
| State | Pinia + pinia-plugin-persistedstate |
| Canvas / drawing | Konva (vue-konva) + perfect-freehand |
| Offline storage | Dexie.js (IndexedDB) |
| PWA / service worker | vite-plugin-pwa + Workbox |
| Mobile | Capacitor 6 (iOS 16+, Android 10+) |
| Backend | Laravel 11 (separate repo) — API defined in PRD §7 |

---

## Prerequisites

- Node 20+
- npm 10+
- (For native builds) Xcode 15+ / Android Studio Giraffe+

---

## Local development

```bash
cd mobile
cp .env.example .env          # set VITE_API_BASE_URL to your Laravel dev server
npm install
npm run dev                   # → http://localhost:5173
```

The app loads **Proverbs 19 (BSB)** from a bundled fixture before a backend is connected, so the reader is immediately usable without a running Laravel server.

---

## PWA build (web / desktop)

```bash
npm run build                 # outputs to dist/
npm run preview               # preview the production build locally
```

---

## iOS build

```bash
npm run cap:ios
# → opens Xcode with the generated project
# Set your Team & Bundle ID in Signing & Capabilities
# Run on simulator or device
```

## Android build

```bash
npm run cap:android
# → opens Android Studio
# Run on emulator or connected device
```

---

## Project structure

```
mobile/
├── capacitor.config.ts       # iOS 16+ / Android 10+ Capacitor config
├── vite.config.js            # Vite + PWA (cache-first scripture, network-first sync)
├── tailwind.config.js        # Ink-navy / gilded-gold palette; Light/Dark/Sepia tokens
├── src/
│   ├── main.js               # App bootstrap; theme init; sync loop start
│   ├── App.vue               # Root shell + router-view
│   ├── router/               # Route definitions + auth guards
│   ├── stores/
│   │   ├── auth.js           # Sanctum session / Capacitor bearer token
│   │   ├── settings.js       # Theme, font-size, line-height, pen-feel
│   │   ├── tool.js           # Active annotation tool, colour, stroke width
│   │   └── sync.js           # Online status, pending count, conflict queue
│   ├── lib/
│   │   ├── db.js             # Dexie schema (mirrors PRD §4.2)
│   │   ├── api.js            # Laravel API client (PRD §7 endpoints)
│   │   ├── annotationRepository.js  # Offline-first CRUD + outbox enqueue
│   │   ├── passageRepository.js     # Cache-first scripture loading
│   │   ├── syncService.js    # Outbox drain → Laravel batch upsert
│   │   └── mockPassage.js    # Bundled PRO 19 fixture for zero-config demo
│   ├── composables/
│   │   ├── useAnnotationCanvas.js   # perfect-freehand → Konva SVG path
│   │   ├── useTextSelection.js      # Native selection → char offsets
│   │   ├── useObservable.js         # Dexie liveQuery ↔ Vue ref
│   │   ├── useOfflineStatus.js      # Capacitor Network → sync store
│   │   └── useStudySession.js       # Records study_sessions rows
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.vue         # Bottom tab navigation
│   │   │   └── OfflineIndicator.vue # Status bar offline banner
│   │   ├── reader/
│   │   │   ├── ScriptureReader.vue  # Main reading + annotation surface
│   │   │   ├── VerseBlock.vue       # Verse text with superscript numbers & footnotes
│   │   │   ├── ChapterNav.vue       # Prev/Next chapter header
│   │   │   └── TranslationSelector.vue
│   │   ├── annotation/
│   │   │   ├── AnnotationCanvas.vue # Konva overlay (highlights layer + drawing layer)
│   │   │   ├── AnnotationToolbar.vue # Floating FAB + tool tray
│   │   │   ├── ColourPalette.vue    # 8 presets + custom picker
│   │   │   ├── NoteModal.vue        # Typed note + notebook tagging
│   │   │   └── StrokeSettingsPanel.vue  # Width, opacity, pen-feel sliders
│   │   ├── notes/
│   │   │   └── StudyNotesPanel.vue  # Commentary + cross-references (PRD §5.3)
│   │   └── ui/                      # shadcn-vue style components (reka-ui)
│   │       ├── button/ badge/ card/ input/ separator/ switch/
│   │       ├── slider/ popover/ select/ tabs/ sheet/ dialog/
│   └── views/
│       ├── ReaderView.vue
│       ├── BookPickerView.vue       # 66-book searchable picker
│       ├── AnnotationsView.vue      # Searchable annotation list (PRD §5.5)
│       ├── NotebooksView.vue        # Notebook CRUD (PRD §11.1)
│       ├── NotebookDetailView.vue   # Many-to-many annotation list
│       ├── BookmarksView.vue
│       ├── HistoryView.vue          # Study session history
│       ├── SettingsView.vue         # Theme / font / offline / account
│       ├── AuthLoginView.vue
│       └── AuthRegisterView.vue
```

---

## Implementation phases mapping (PRD §10)

| PRD Phase | Status in this codebase |
|---|---|
| Phase 1 — Foundation | ✅ Dexie schema, API client, router, auth store, passage loading with demo fixture |
| Phase 2 — Annotation Core | ✅ Konva canvas overlay, highlight tool, freehand pen (perfect-freehand), Dexie persistence |
| Phase 3 — Extended Annotations | ✅ Typed notes, underline tool, eraser, colour palette, stroke settings, outbox pattern |
| Phase 4 — Study Notes Panel | ✅ StudyNotesPanel, verse-tap → notes sheet, cross-reference rendering |
| Phase 5 — Offline & PWA | ✅ Dexie offline repo, Workbox service worker config, offline indicator, book download |
| Phase 6 — Mobile (Capacitor) | ✅ Capacitor config, Network plugin, Preferences (token storage), StatusBar |
| Phase 7 — Polish & Launch | ⏳ Dark/Sepia themes ✅ · PDF export ⏳ · perf audit ⏳ · a11y audit ⏳ |

---

## Bible translation licensing (PRD §11.5)

v1 ships public-domain translations only (BSB, KJV, ASV). The paid API.Bible Pro tier for copyrighted translations (ESV, NIV, NKJV) is deferred post-launch. The `TranslationSelector` component is already structured to add these when licensing is ready.
