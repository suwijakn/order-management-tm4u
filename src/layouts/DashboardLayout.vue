<script setup>
import { ref, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { usePendingsStore } from "@/stores/pendings";
import ConnectionStatus from "@/components/ConnectionStatus.vue";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const pendingsStore = usePendingsStore();

// UI state
const userMenuOpen = ref(false);
const mobileMenuOpen = ref(false);

// Default to current month
const selectedMonth = ref(new Date().toISOString().slice(0, 7));

// Role-based checks
const isSuperAdmin = computed(() => authStore.userRole === "super_admin");
const isManagerOrAbove = computed(() =>
  ["manager", "super_admin"].includes(authStore.userRole),
);

// Pending count for badge
const pendingCount = computed(() => pendingsStore.allPendingItems.length);

// Navigation items with role-based visibility
const navigationItems = computed(() => [
  {
    name: "Dashboard",
    route: "/dashboard",
    visible: true,
    icon: "📊",
  },
  {
    name: "Pending",
    route: "/pending-approvals",
    visible: isManagerOrAbove.value,
    badge: pendingCount.value > 0 ? pendingCount.value : null,
    icon: "⏳",
  },
  {
    name: "Columns",
    route: "/manage-columns",
    visible: isSuperAdmin.value,
    icon: "⚙️",
  },
  {
    name: "Permissions",
    route: "/manage-permissions",
    visible: isSuperAdmin.value,
    icon: "🔒",
  },
  {
    name: "Deleted",
    route: "/deleted-orders",
    visible: isManagerOrAbove.value,
    icon: "🗑️",
  },
  {
    name: "Audit Logs",
    route: "/audit-logs",
    visible: isSuperAdmin.value,
    icon: "📝",
  },
]);

// Filter to only visible items
const visibleNavItems = computed(() =>
  navigationItems.value.filter((item) => item.visible),
);

// Check if route is active
function isActiveRoute(itemRoute) {
  return route.path === itemRoute;
}

// Handle logout
async function handleLogout() {
  await authStore.logout();
  router.push({ name: "Login" });
}

// Toggle mobile menu
function toggleMobileMenu() {
  mobileMenuOpen.value = !mobileMenuOpen.value;
}

// Close mobile menu
function closeMobileMenu() {
  mobileMenuOpen.value = false;
}

// Toggle user menu
function toggleUserMenu() {
  userMenuOpen.value = !userMenuOpen.value;
}

// Close user menu
function closeUserMenu() {
  userMenuOpen.value = false;
}

// Emit month change to parent
const emit = defineEmits(["month-change"]);

function handleMonthChange(event) {
  selectedMonth.value = event.target.value;
  emit("month-change", selectedMonth.value);
}
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <!-- Mobile sidebar backdrop -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
      @click="closeSidebar"
    ></div>

    <!-- Sidebar -->
    <aside
      :class="[
        'fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      ]"
    >
      <!-- Logo -->
      <div class="flex items-center justify-between h-16 px-4 bg-gray-800">
        <div class="flex items-center gap-2">
          <svg
            class="w-8 h-8 text-blue-500"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"
            />
          </svg>
          <span class="text-white font-semibold text-lg">Order Mgmt</span>
        </div>
        <!-- Close button (mobile) -->
        <button
          @click="closeSidebar"
          class="lg:hidden text-gray-400 hover:text-white"
        >
          <svg
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- Navigation -->
      <nav class="mt-4 px-2 space-y-1">
        <router-link
          v-for="item in visibleNavItems"
          :key="item.name"
          :to="item.route"
          @click="closeSidebar"
          :class="[
            'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
            isActiveRoute(item.route)
              ? 'bg-gray-800 text-white'
              : 'text-gray-300 hover:bg-gray-700 hover:text-white',
          ]"
        >
          <!-- Icons -->
          <svg
            v-if="item.icon === 'table'"
            class="mr-3 h-5 w-5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <svg
            v-else-if="item.icon === 'clock'"
            class="mr-3 h-5 w-5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <svg
            v-else-if="item.icon === 'columns'"
            class="mr-3 h-5 w-5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
            />
          </svg>
          <svg
            v-else-if="item.icon === 'shield'"
            class="mr-3 h-5 w-5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <svg
            v-else-if="item.icon === 'trash'"
            class="mr-3 h-5 w-5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          <svg
            v-else-if="item.icon === 'document'"
            class="mr-3 h-5 w-5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>

          <span class="flex-1">{{ item.name }}</span>

          <!-- Badge -->
          <span
            v-if="item.badge"
            class="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full"
          >
            {{ item.badge > 99 ? "99+" : item.badge }}
          </span>
        </router-link>
      </nav>

      <!-- Connection status at bottom of sidebar -->
      <div
        class="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700"
      >
        <ConnectionStatus />
      </div>
    </aside>

    <!-- Main content area -->
    <div class="lg:pl-64 flex flex-col min-h-screen">
      <!-- Top navigation bar -->
      <header
        class="sticky top-0 z-30 bg-white shadow-sm border-b border-gray-200"
      >
        <div
          class="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8"
        >
          <!-- Left side: hamburger + title -->
          <div class="flex items-center gap-4">
            <!-- Mobile menu button -->
            <button
              @click="toggleSidebar"
              class="lg:hidden text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              <svg
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            <!-- Page title (hidden on mobile) -->
            <h1 class="hidden sm:block text-lg font-semibold text-gray-900">
              <slot name="title">Dashboard</slot>
            </h1>
          </div>

          <!-- Right side: month selector + user menu -->
          <div class="flex items-center gap-4">
            <!-- Month/Year selector -->
            <div class="flex items-center gap-2">
              <label class="hidden sm:block text-sm font-medium text-gray-700"
                >Month:</label
              >
              <input
                type="month"
                :value="selectedMonth"
                @input="handleMonthChange"
                class="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <!-- Connection status (desktop only) -->
            <div class="hidden md:block">
              <ConnectionStatus />
            </div>

            <!-- User menu -->
            <div class="relative">
              <button
                @click="toggleUserMenu"
                class="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 focus:outline-none"
              >
                <!-- Avatar -->
                <div
                  class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium"
                >
                  {{ authStore.userName?.charAt(0)?.toUpperCase() || "U" }}
                </div>
                <span class="hidden sm:block max-w-[120px] truncate">
                  {{ authStore.userName || authStore.userEmail }}
                </span>
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              <!-- Dropdown menu -->
              <div
                v-if="userMenuOpen"
                class="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50"
                @click.stop
              >
                <div class="py-1">
                  <!-- User info -->
                  <div class="px-4 py-2 border-b border-gray-100">
                    <p class="text-sm font-medium text-gray-900 truncate">
                      {{ authStore.userName || "User" }}
                    </p>
                    <p class="text-xs text-gray-500 truncate">
                      {{ authStore.userEmail }}
                    </p>
                    <p class="text-xs text-gray-400 mt-1">
                      Role:
                      <span class="font-medium">{{
                        authStore.userRole || "Unknown"
                      }}</span>
                    </p>
                  </div>

                  <!-- Menu items -->
                  <router-link
                    to="/profile"
                    class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    @click="closeUserMenu"
                  >
                    <div class="flex items-center gap-2">
                      <svg
                        class="w-4 h-4"
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
                      Profile
                    </div>
                  </router-link>

                  <button
                    @click="handleLogout"
                    class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <div class="flex items-center gap-2">
                      <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      Logout
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- Page content -->
      <main class="flex-1 p-4 sm:p-6 lg:p-8">
        <slot :selected-month="selectedMonth"></slot>
      </main>
    </div>

    <!-- Click outside to close user menu -->
    <div
      v-if="userMenuOpen"
      class="fixed inset-0 z-40"
      @click="closeUserMenu"
    ></div>
  </div>
</template>
