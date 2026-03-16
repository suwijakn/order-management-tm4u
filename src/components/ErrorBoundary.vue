<script setup>
import { ref, onErrorCaptured } from "vue";
import { handleError } from "@/utils/errorHandler";

const hasError = ref(false);
const errorMessage = ref("");

onErrorCaptured((err, instance, info) => {
  console.error("[ErrorBoundary] Caught error:", {
    error: err,
    component: instance?.$options?.name || "Unknown",
    info,
  });

  hasError.value = true;
  errorMessage.value = handleError(err, "ErrorBoundary");

  // Prevent error from propagating
  return false;
});

function retry() {
  hasError.value = false;
  errorMessage.value = "";
  window.location.reload();
}
</script>

<template>
  <div v-if="hasError" class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
    <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
      <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg
          class="w-8 h-8 text-red-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      
      <h2 class="text-xl font-semibold text-gray-900 mb-2">
        Something went wrong
      </h2>
      
      <p class="text-gray-600 mb-6">
        {{ errorMessage }}
      </p>
      
      <button
        @click="retry"
        class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        Reload Page
      </button>
      
      <p class="text-xs text-gray-500 mt-4">
        If the problem persists, please contact support.
      </p>
    </div>
  </div>
  
  <slot v-else />
</template>
