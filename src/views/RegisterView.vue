<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const displayName = ref('')
const isLoading = ref(false)
const localError = ref('')
const registrationComplete = ref(false)

const passwordsMatch = computed(() => password.value === confirmPassword.value)
const passwordStrength = computed(() => {
  const pwd = password.value
  if (!pwd) return { level: 0, text: '', color: '' }
  
  let score = 0
  if (pwd.length >= 8) score++
  if (pwd.length >= 12) score++
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++
  if (/\d/.test(pwd)) score++
  if (/[^a-zA-Z0-9]/.test(pwd)) score++
  
  if (score <= 2) return { level: score, text: 'Weak', color: 'bg-red-500' }
  if (score <= 3) return { level: score, text: 'Fair', color: 'bg-yellow-500' }
  if (score <= 4) return { level: score, text: 'Good', color: 'bg-blue-500' }
  return { level: score, text: 'Strong', color: 'bg-green-500' }
})

const isFormValid = computed(() => {
  return email.value && 
         password.value.length >= 6 && 
         passwordsMatch.value &&
         displayName.value.trim().length >= 2
})

async function handleRegister() {
  localError.value = ''
  
  if (!isFormValid.value) {
    localError.value = 'Please fill in all fields correctly.'
    return
  }

  if (!passwordsMatch.value) {
    localError.value = 'Passwords do not match.'
    return
  }

  if (password.value.length < 6) {
    localError.value = 'Password must be at least 6 characters.'
    return
  }

  isLoading.value = true
  try {
    await authStore.register(email.value, password.value, displayName.value.trim())
    registrationComplete.value = true
  } catch (error) {
    // T-INFO-003: Generic error messages
    if (error.code === 'auth/email-already-in-use') {
      localError.value = 'An account with this email already exists.'
    } else if (error.code === 'auth/weak-password') {
      localError.value = 'Please choose a stronger password.'
    } else {
      localError.value = 'Registration failed. Please try again.'
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
      <!-- Registration Complete State -->
      <div v-if="registrationComplete" class="text-center py-8">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-gray-900 mb-2">Account Created!</h2>
        <p class="text-gray-600 mb-6">
          We've sent a verification email to <strong>{{ email }}</strong>. 
          Please check your inbox and verify your email to activate your account.
        </p>
        <div class="p-4 bg-blue-50 rounded-lg mb-6">
          <p class="text-sm text-blue-700">
            <strong>Note:</strong> You may need to check your spam folder if you don't see the email.
          </p>
        </div>
        <button
          @click="goToLogin"
          class="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          Go to Login
        </button>
      </div>

      <!-- Registration Form -->
      <template v-else>
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-gray-900">Create Account</h1>
          <p class="text-gray-500 mt-1">Join TM4U Order Management</p>
        </div>

        <form @submit.prevent="handleRegister" class="space-y-5">
          <div>
            <label for="displayName" class="block text-sm font-medium text-gray-700 mb-1.5">
              Full Name
            </label>
            <input
              id="displayName"
              v-model="displayName"
              type="text"
              required
              autocomplete="name"
              :disabled="isLoading"
              class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="John Doe"
            />
          </div>

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

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <input
              id="password"
              v-model="password"
              type="password"
              required
              autocomplete="new-password"
              :disabled="isLoading"
              class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="At least 6 characters"
            />
            <!-- Password strength indicator -->
            <div v-if="password" class="mt-2">
              <div class="flex items-center gap-2">
                <div class="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    :class="[passwordStrength.color, 'h-full transition-all duration-300']"
                    :style="{ width: `${(passwordStrength.level / 5) * 100}%` }"
                  ></div>
                </div>
                <span class="text-xs font-medium" :class="{
                  'text-red-600': passwordStrength.level <= 2,
                  'text-yellow-600': passwordStrength.level === 3,
                  'text-blue-600': passwordStrength.level === 4,
                  'text-green-600': passwordStrength.level === 5
                }">
                  {{ passwordStrength.text }}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-1.5">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              required
              autocomplete="new-password"
              :disabled="isLoading"
              class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
              :class="{ 'border-red-300': confirmPassword && !passwordsMatch }"
              placeholder="Re-enter your password"
            />
            <p v-if="confirmPassword && !passwordsMatch" class="mt-1 text-sm text-red-600">
              Passwords do not match
            </p>
          </div>

          <!-- Error message -->
          <div v-if="localError || authStore.error" class="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p class="text-sm text-red-600 text-center">
              {{ localError || authStore.error }}
            </p>
          </div>

          <button
            type="submit"
            :disabled="isLoading || !isFormValid"
            class="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center"
          >
            <svg v-if="isLoading" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ isLoading ? 'Creating account...' : 'Create Account' }}</span>
          </button>
        </form>

        <div class="mt-6 text-center">
          <p class="text-sm text-gray-500">
            Already have an account?
            <router-link to="/login" class="text-blue-600 hover:text-blue-800 font-medium">
              Sign in
            </router-link>
          </p>
        </div>
      </template>
    </div>
  </div>
</template>
