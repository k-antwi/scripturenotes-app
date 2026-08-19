<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/auth'
import { Loader2 } from 'lucide-vue-next'

const auth = useAuthStore()
const router = useRouter()

const name = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

const canSubmit = computed(() => name.value && email.value && password.value.length >= 8)

import { computed } from 'vue'

async function register() {
  loading.value = true
  errorMsg.value = ''
  try {
    await auth.register({ name: name.value, email: email.value, password: password.value })
    router.push('/')
  } catch (e) {
    errorMsg.value = e.response?.data?.message ?? 'Registration failed. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center px-6 safe-top">
    <div class="w-full max-w-sm space-y-6">
      <div class="text-center">
        <h1 class="font-scripture text-3xl font-bold text-foreground">Create account</h1>
        <p class="mt-1 text-sm text-muted-foreground">Your annotations will sync across devices.</p>
      </div>

      <div class="space-y-3">
        <Input v-model="name" placeholder="Your name" autocomplete="name" />
        <Input v-model="email" type="email" placeholder="Email" autocomplete="email" inputmode="email" />
        <Input v-model="password" type="password" placeholder="Password (8+ characters)" autocomplete="new-password" />

        <p v-if="errorMsg" class="text-sm text-destructive">{{ errorMsg }}</p>

        <Button class="w-full" :disabled="loading || !canSubmit" @click="register">
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin mr-2" />
          Create account
        </Button>
      </div>

      <div class="text-center text-sm text-muted-foreground">
        Already have an account?
        <router-link class="text-primary underline-offset-2 hover:underline" :to="{ name: 'login' }">
          Sign in
        </router-link>
      </div>
    </div>
  </div>
</template>
