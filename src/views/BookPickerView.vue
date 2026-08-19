<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Search, ChevronRight } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// Abbreviations + chapter counts for the 66 canonical books
const BOOKS = [
  { abbr: 'GEN', name: 'Genesis', chapters: 50 }, { abbr: 'EXO', name: 'Exodus', chapters: 40 },
  { abbr: 'LEV', name: 'Leviticus', chapters: 27 }, { abbr: 'NUM', name: 'Numbers', chapters: 36 },
  { abbr: 'DEU', name: 'Deuteronomy', chapters: 34 }, { abbr: 'JOS', name: 'Joshua', chapters: 24 },
  { abbr: 'JDG', name: 'Judges', chapters: 21 }, { abbr: 'RUT', name: 'Ruth', chapters: 4 },
  { abbr: '1SA', name: '1 Samuel', chapters: 31 }, { abbr: '2SA', name: '2 Samuel', chapters: 24 },
  { abbr: '1KI', name: '1 Kings', chapters: 22 }, { abbr: '2KI', name: '2 Kings', chapters: 25 },
  { abbr: '1CH', name: '1 Chronicles', chapters: 29 }, { abbr: '2CH', name: '2 Chronicles', chapters: 36 },
  { abbr: 'EZR', name: 'Ezra', chapters: 10 }, { abbr: 'NEH', name: 'Nehemiah', chapters: 13 },
  { abbr: 'EST', name: 'Esther', chapters: 10 }, { abbr: 'JOB', name: 'Job', chapters: 42 },
  { abbr: 'PSA', name: 'Psalms', chapters: 150 }, { abbr: 'PRO', name: 'Proverbs', chapters: 31 },
  { abbr: 'ECC', name: 'Ecclesiastes', chapters: 12 }, { abbr: 'SNG', name: 'Song of Solomon', chapters: 8 },
  { abbr: 'ISA', name: 'Isaiah', chapters: 66 }, { abbr: 'JER', name: 'Jeremiah', chapters: 52 },
  { abbr: 'LAM', name: 'Lamentations', chapters: 5 }, { abbr: 'EZK', name: 'Ezekiel', chapters: 48 },
  { abbr: 'DAN', name: 'Daniel', chapters: 12 }, { abbr: 'HOS', name: 'Hosea', chapters: 14 },
  { abbr: 'JOL', name: 'Joel', chapters: 3 }, { abbr: 'AMO', name: 'Amos', chapters: 9 },
  { abbr: 'OBA', name: 'Obadiah', chapters: 1 }, { abbr: 'JON', name: 'Jonah', chapters: 4 },
  { abbr: 'MIC', name: 'Micah', chapters: 7 }, { abbr: 'NAM', name: 'Nahum', chapters: 3 },
  { abbr: 'HAB', name: 'Habakkuk', chapters: 3 }, { abbr: 'ZEP', name: 'Zephaniah', chapters: 3 },
  { abbr: 'HAG', name: 'Haggai', chapters: 2 }, { abbr: 'ZEC', name: 'Zechariah', chapters: 14 },
  { abbr: 'MAL', name: 'Malachi', chapters: 4 },
  // NT
  { abbr: 'MAT', name: 'Matthew', chapters: 28 }, { abbr: 'MRK', name: 'Mark', chapters: 16 },
  { abbr: 'LUK', name: 'Luke', chapters: 24 }, { abbr: 'JHN', name: 'John', chapters: 21 },
  { abbr: 'ACT', name: 'Acts', chapters: 28 }, { abbr: 'ROM', name: 'Romans', chapters: 16 },
  { abbr: '1CO', name: '1 Corinthians', chapters: 16 }, { abbr: '2CO', name: '2 Corinthians', chapters: 13 },
  { abbr: 'GAL', name: 'Galatians', chapters: 6 }, { abbr: 'EPH', name: 'Ephesians', chapters: 6 },
  { abbr: 'PHP', name: 'Philippians', chapters: 4 }, { abbr: 'COL', name: 'Colossians', chapters: 4 },
  { abbr: '1TH', name: '1 Thessalonians', chapters: 5 }, { abbr: '2TH', name: '2 Thessalonians', chapters: 3 },
  { abbr: '1TI', name: '1 Timothy', chapters: 6 }, { abbr: '2TI', name: '2 Timothy', chapters: 4 },
  { abbr: 'TIT', name: 'Titus', chapters: 3 }, { abbr: 'PHM', name: 'Philemon', chapters: 1 },
  { abbr: 'HEB', name: 'Hebrews', chapters: 13 }, { abbr: 'JAS', name: 'James', chapters: 5 },
  { abbr: '1PE', name: '1 Peter', chapters: 5 }, { abbr: '2PE', name: '2 Peter', chapters: 3 },
  { abbr: '1JN', name: '1 John', chapters: 5 }, { abbr: '2JN', name: '2 John', chapters: 1 },
  { abbr: '3JN', name: '3 John', chapters: 1 }, { abbr: 'JUD', name: 'Jude', chapters: 1 },
  { abbr: 'REV', name: 'Revelation', chapters: 22 }
]

const router = useRouter()
const query = ref('')
const selectedBook = ref(null)

const filtered = computed(() => {
  if (!query.value.trim()) return BOOKS
  const q = query.value.toLowerCase()
  return BOOKS.filter((b) =>
    b.name.toLowerCase().includes(q) || b.abbr.toLowerCase().includes(q)
  )
})

function pickBook(book) {
  if (book.chapters === 1) {
    router.push({ name: 'reader', params: { book: book.abbr, chapter: 1 } })
    return
  }
  selectedBook.value = book
}

function pickChapter(ch) {
  router.push({ name: 'reader', params: { book: selectedBook.value.abbr, chapter: ch } })
}

function chapterRange(n) {
  return Array.from({ length: n }, (_, i) => i + 1)
}
</script>

<template>
  <div class="flex h-full flex-col safe-top">
    <div class="flex items-center gap-3 px-4 pt-4 pb-3">
      <h1 class="text-lg font-semibold flex-1">Go to passage</h1>
      <Button variant="ghost" size="sm" @click="router.back()">Cancel</Button>
    </div>

    <div class="px-4 pb-3">
      <div class="relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input v-model="query" placeholder="Search books (e.g. Pro 19)…" class="pl-9" />
      </div>
    </div>

    <!-- Chapter picker overlay when a book is selected -->
    <template v-if="selectedBook">
      <div class="flex items-center gap-2 border-b border-border px-4 py-3">
        <button type="button" class="text-sm text-muted-foreground hover:text-foreground" @click="selectedBook = null">
          Books
        </button>
        <span class="text-muted-foreground">/</span>
        <span class="text-sm font-medium">{{ selectedBook.name }}</span>
      </div>
      <div class="flex-1 overflow-y-auto px-4 py-3">
        <div class="grid grid-cols-6 gap-2">
          <button
            v-for="ch in chapterRange(selectedBook.chapters)"
            :key="ch"
            type="button"
            class="flex h-11 w-full items-center justify-center rounded-lg border border-border text-sm font-medium hover:bg-secondary active:bg-secondary/80"
            @click="pickChapter(ch)"
          >
            {{ ch }}
          </button>
        </div>
      </div>
    </template>

    <!-- Book list -->
    <template v-else>
      <div class="flex-1 overflow-y-auto">
        <button
          v-for="book in filtered"
          :key="book.abbr"
          type="button"
          class="flex w-full items-center justify-between border-b border-border/60 px-4 py-3.5 text-left active:bg-secondary"
          @click="pickBook(book)"
        >
          <span class="text-base font-medium">{{ book.name }}</span>
          <span class="flex items-center gap-1 text-xs text-muted-foreground">
            {{ book.chapters }} ch
            <ChevronRight class="h-4 w-4" />
          </span>
        </button>
      </div>
    </template>
  </div>
</template>
