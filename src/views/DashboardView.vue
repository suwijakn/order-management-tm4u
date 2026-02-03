<script setup>
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

async function handleLogout() {
  await authStore.logout()
  router.push({ name: 'Login' })
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center">
            <h1 class="text-xl font-bold text-primary-600">TM4U</h1>
          </div>
          <div class="flex items-center space-x-4">
            <span class="text-sm text-gray-600">
              {{ authStore.userName }}
            </span>
            <button
              @click="handleLogout"
              class="btn-secondary text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="mb-8">
        <h2 class="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p class="text-gray-600 mt-1">Welcome to the Order Management System</p>
      </div>

      <!-- Placeholder Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div class="card">
          <div class="text-sm text-gray-500">Total Orders</div>
          <div class="text-3xl font-bold text-gray-900 mt-2">--</div>
        </div>
        <div class="card">
          <div class="text-sm text-gray-500">Pending Orders</div>
          <div class="text-3xl font-bold text-yellow-600 mt-2">--</div>
        </div>
        <div class="card">
          <div class="text-sm text-gray-500">Completed</div>
          <div class="text-3xl font-bold text-green-600 mt-2">--</div>
        </div>
        <div class="card">
          <div class="text-sm text-gray-500">Revenue</div>
          <div class="text-3xl font-bold text-primary-600 mt-2">--</div>
        </div>
      </div>

      <!-- Placeholder Content Area -->
      <div class="card">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Recent Orders</h3>
        <p class="text-gray-500 text-center py-8">
          No orders yet. Order data will appear here.
        </p>
      </div>
    </main>
  </div>
</template>
