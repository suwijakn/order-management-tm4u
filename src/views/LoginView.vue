<script setup>
import { ref, computed } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useRouter } from "vue-router";
import { useAuth } from "@/composables/useAuth";

const authStore = useAuthStore();
const router = useRouter();
const {
  checkRateLimit,
  recordFailedAttempt,
  clearFailedAttempts,
  getFailedAttempts,
} = useAuth();

const email = ref("");
const password = ref("");
const rememberMe = ref(false);
const isLoading = ref(false);
const localError = ref("");
const showCaptcha = ref(false);
const captchaVerified = ref(false);

const failedAttempts = computed(() => getFailedAttempts());
const requiresCaptcha = computed(() => failedAttempts.value >= 3);

async function handleLogin() {
  localError.value = "";

  // Check rate limit (T-AUTH-002: 5 attempts/15min)
  const rateLimitResult = checkRateLimit();
  if (!rateLimitResult.allowed) {
    localError.value = `Too many login attempts. Please try again in ${rateLimitResult.remainingMinutes} minutes.`;
    return;
  }

  // Require CAPTCHA after 3 failed attempts (T-AUTH-002)
  if (requiresCaptcha.value && !captchaVerified.value) {
    showCaptcha.value = true;
    localError.value = "Please complete the security verification.";
    return;
  }

  isLoading.value = true;
  try {
    await authStore.login(email.value, password.value, rememberMe.value);
    clearFailedAttempts();
    router.push({ name: "Dashboard" });
  } catch (error) {
    recordFailedAttempt();
    // T-INFO-003: Generic error messages only
    localError.value = "Invalid email or password. Please try again.";

    if (getFailedAttempts() >= 3) {
      showCaptcha.value = true;
      captchaVerified.value = false;
    }
  } finally {
    isLoading.value = false;
  }
}

function handleCaptchaVerify() {
  captchaVerified.value = true;
  showCaptcha.value = false;
  localError.value = "";
}

function handleForgotPassword() {
  router.push({ name: "ForgotPassword" });
}
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-800 px-4 py-8"
  >
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
      <div class="text-center mb-8">
        <div
          class="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4"
        >
          <svg
            class="w-8 h-8 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-gray-900">Welcome to TM4U</h1>
        <p class="text-gray-500 mt-1">Order Management System</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-5">
        <div>
          <label
            for="email"
            class="block text-sm font-medium text-gray-700 mb-1.5"
          >
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
          <label
            for="password"
            class="block text-sm font-medium text-gray-700 mb-1.5"
          >
            Password
          </label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            :disabled="isLoading"
            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder="Enter your password"
          />
        </div>

        <div class="flex items-center justify-between">
          <label class="flex items-center cursor-pointer">
            <input
              v-model="rememberMe"
              type="checkbox"
              :disabled="isLoading"
              class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span class="ml-2 text-sm text-gray-600"
              >Remember me for 30 days</span
            >
          </label>
          <button
            type="button"
            @click="handleForgotPassword"
            class="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Forgot password?
          </button>
        </div>

        <!-- CAPTCHA placeholder (T-AUTH-002) -->
        <div
          v-if="showCaptcha && !captchaVerified"
          class="p-4 bg-gray-50 rounded-lg border border-gray-200"
        >
          <p class="text-sm text-gray-600 mb-3">Please verify you're human:</p>
          <button
            type="button"
            @click="handleCaptchaVerify"
            class="w-full py-2 px-4 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium text-gray-700 transition-colors"
          >
            Click to verify (CAPTCHA placeholder)
          </button>
        </div>

        <div
          v-if="captchaVerified"
          class="flex items-center text-sm text-green-600"
        >
          <svg class="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clip-rule="evenodd"
            />
          </svg>
          Verification complete
        </div>

        <!-- Error message (T-INFO-003: Generic messages only) -->
        <div
          v-if="localError || authStore.error"
          class="p-3 bg-red-50 border border-red-200 rounded-lg"
        >
          <p class="text-sm text-red-600 text-center">
            {{ localError || authStore.error }}
          </p>
        </div>

        <!-- Failed attempts warning -->
        <div
          v-if="failedAttempts > 0 && failedAttempts < 5"
          class="text-sm text-amber-600 text-center"
        >
          {{ 5 - failedAttempts }} attempts remaining before temporary lockout
        </div>

        <button
          type="submit"
          :disabled="isLoading || (requiresCaptcha && !captchaVerified)"
          class="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center"
        >
          <svg
            v-if="isLoading"
            class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span>{{ isLoading ? "Signing in..." : "Sign In" }}</span>
        </button>
      </form>

      <div class="mt-6 text-center">
        <p class="text-sm text-gray-500">
          Don't have an account?
          <router-link
            to="/register"
            class="text-blue-600 hover:text-blue-800 font-medium"
          >
            Create one
          </router-link>
        </p>
      </div>
    </div>
  </div>
</template>
