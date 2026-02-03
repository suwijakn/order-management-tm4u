<script setup>
import { ref } from 'vue'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/services/firebase'
import { useRouter } from 'vue-router'

const router = useRouter()

const email = ref('')
const isLoading = ref(false)
const error = ref('')
const emailSent = ref(false)

async function handleResetPassword() {
  error.value = ''
  
  if (!email.value) {
    error.value = 'Please enter your email address.'
    return
  }

  isLoading.value = true
  try {
    await sendPasswordResetEmail(auth, email.value)
    emailSent.value = true
  } catch (err) {
    // T-INFO-003: Generic error messages
    if (err.code === 'auth/user-not-found') {
      // Don't reveal if email exists or not
      emailSent.value = true
    } else if (err.code === 'auth/invalid-email') {
      error.value = 'Please enter a valid email address.'
    } else if (err.code === 'auth/too-many-requests') {
      error.value = 'Too many requests. Please try again later.'
    } else {
      error.value = 'Unable to send reset email. Please try again.'
    }
  } finally {
    isLoading.value = false
  }
}

function goToLogin() {
  router.push({ name: 'Login' })
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-800 px-4 py-8">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
      <!-- Email Sent State -->
      <div v-if="emailSent" class="text-center py-8">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h2>
        <p class="text-gray-600 mb-6">
          If an account exists for <strong>{{ email }}</strong>, you will receive a password reset link shortly.
        </p>
        <div class="p-4 bg-blue-50 rounded-lg mb-6">
          <p class="text-sm text-blue-700">
            <strong>Note:</strong> Check your spam folder if you don't see the email within a few minutes.
          </p>
        </div>
        <button
          @click="goToLogin"
          class="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          Back to Login
        </button>
      </div>

      <!-- Reset Password Form -->
      <template v-else>
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-gray-900">Reset Password</h1>
          <p class="text-gray-500 mt-1">Enter your email to receive a reset link</p>
        </div>

        <form @submit.prevent="handleResetPassword" class="space-y-5">
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 mb-1.5">
              Email Address
            </label>
            <input
              id="email"
              v-model="email"
              type="email"
              required
              autocomplete="email"
              :disabled="isLoading"
              class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="you@example.com"
            />
          </div>

          <!-- Error message -->
          <div v-if="error" class="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p class="text-sm text-red-600 text-center">{{ error }}</p>
          </div>

          <button
            type="submit"
            :disabled="isLoading"
            class="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center"
          >
            <svg v-if="isLoading" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ isLoading ? 'Sending...' : 'Send Reset Link' }}</span>
          </button>
        </form>

        <div class="mt-6 text-center">
          <router-link to="/login" class="text-sm text-blue-600 hover:text-blue-800 font-medium">
            ← Back to Login
          </router-link>
        </div>
      </template>
    </div>
  </div>
</template>
