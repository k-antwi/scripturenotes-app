<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/auth'
import { Loader2 } from 'lucide-vue-next'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function login() {
  loading.value = true
  errorMsg.value = ''
  try {
    await auth.login({ email: email.value, password: password.value })
    router.push(route.query.redirect ?? '/')
  } catch (e) {
    errorMsg.value = e.response?.data?.message ?? 'Login failed. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center px-6 safe-top">
    <div class="w-full max-w-sm space-y-6">
      <!-- Wordmark -->
      <div class="text-center">
        <h1 class="font-scripture text-3xl font-bold text-foreground">Bible Study</h1>
        <p class="mt-1 text-sm text-muted-foreground">Read, mark, and learn.</p>
      </div>

      <div class="space-y-3">
        <Input
          v-model="email"
          type="email"
          placeholder="Email"
          autocomplete="email"
          inputmode="email"
        />
        <Input
          v-model="password"
          type="password"
          placeholder="Password"
          autocomplete="current-password"
          @keyup.enter="login"
        />

        <p v-if="errorMsg" class="text-sm text-destructive">{{ errorMsg }}</p>

        <Button class="w-full" :disabled="loading || !email || !password" @click="login">
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin mr-2" />
          Sign in
        </Button>
      </div>

      <div class="text-center text-sm text-muted-foreground">
        No account?
        <router-link class="text-primary underline-offset-2 hover:underline" :to="{ name: 'register' }">
          Register
        </router-link>
      </div>

      <div class="text-center">
        <router-link class="text-sm text-muted-foreground hover:text-foreground" to="/">
          Continue without an account →
        </router-link>
      </div>
    </div>
  </div>
</template>
