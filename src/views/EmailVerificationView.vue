<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

const isLoading = ref(false)
const error = ref('')
const success = ref(false)
const countdown = ref(60)
const canResend = ref(false)
let countdownInterval = null

function startCountdown() {
  countdown.value = 60
  canResend.value = false
  
  countdownInterval = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(countdownInterval)
      canResend.value = true
    }
  }, 1000)
}

async function handleResendEmail() {
  if (!canResend.value) return
  
  error.value = ''
  isLoading.value = true
  
  try {
    await authStore.resendVerificationEmail()
    success.value = true
    startCountdown()
  } catch (err) {
    error.value = 'Unable to send verification email. Please try again.'
  } finally {
    isLoading.value = false
  }
}

async function handleSignOut() {
  try {
    await authStore.logout()
    router.push({ name: 'Login' })
  } catch (err) {
    error.value = 'Unable to sign out. Please try again.'
  }
}

function checkVerificationStatus() {
  // Check if email is now verified
  if (authStore.emailVerified) {
    router.push({ name: 'Dashboard' })
  }
}

onMounted(() => {
  // Start countdown immediately
  startCountdown()
  
  // Check verification status every 5 seconds
  const verificationCheck = setInterval(checkVerificationStatus, 5000)
  
  onUnmounted(() => {
    clearInterval(countdownInterval)
    clearInterval(verificationCheck)
  })
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-800 px-4 py-8">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
          <svg class="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-gray-900">Verify Your Email</h1>
        <p class="text-gray-600 mt-1">Check your inbox for the verification link</p>
      </div>

      <div class="space-y-6">
        <!-- Email info -->
        <div class="p-4 bg-blue-50 rounded-lg">
          <p class="text-sm text-blue-700">
            We've sent a verification email to:
          </p>
          <p class="font-medium text-blue-900 mt-1">
            {{ authStore.userEmail }}
          </p>
        </div>

        <!-- Instructions -->
        <div class="space-y-3">
          <div class="flex items-start space-x-3">
            <div class="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
              <svg class="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </div>
            <p class="text-sm text-gray-600">
              Open the email and click the verification link
            </p>
          </div>
          
          <div class="flex items-start space-x-3">
            <div class="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
              <svg class="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </div>
            <p class="text-sm text-gray-600">
              This page will automatically redirect once verified
            </p>
          </div>
          
          <div class="flex items-start space-x-3">
            <div class="flex-shrink-0 w-5 h-5 bg-amber-100 rounded-full flex items-center justify-center mt-0.5">
              <svg class="w-3 h-3 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
            </div>
            <p class="text-sm text-gray-600">
              Check your spam folder if you don't see the email
            </p>
          </div>
        </div>

        <!-- Success message -->
        <div v-if="success" class="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p class="text-sm text-green-600 text-center">
            Verification email sent successfully!
          </p>
        </div>

        <!-- Error message -->
        <div v-if="error" class="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-sm text-red-600 text-center">{{ error }}</p>
        </div>

        <!-- Resend button -->
        <div class="text-center">
          <button
            @click="handleResendEmail"
            :disabled="!canResend || isLoading"
            class="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="isLoading">Sending...</span>
            <span v-else-if="!canResend">
              Resend in {{ countdown }}s
            </span>
            <span v-else>Resend verification email</span>
          </button>
        </div>

        <!-- Sign out button -->
        <div class="pt-4 border-t border-gray-200">
          <button
            @click="handleSignOut"
            class="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
