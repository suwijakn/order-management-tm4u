<script setup>
import { ref, computed, provide } from "vue";
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
const monthSelectorOpen = ref(false);

// Default to current month
const currentDate = new Date();
const selectedYear = ref(currentDate.getFullYear());
const selectedMonthNum = ref(currentDate.getMonth()); // 0-indexed
const selectedMonth = ref(new Date().toISOString().slice(0, 7));

// Month names for display
const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Available years (5 years back, 5 years forward)
const availableYears = computed(() => {
  const current = new Date().getFullYear();
  const years = [];
  for (let y = current - 5; y <= current + 5; y++) {
    years.push(y);
  }
  return years;
});

// Formatted display of selected month
const selectedMonthDisplay = computed(() => {
  return `${monthNames[selectedMonthNum.value]} ${selectedYear.value}`;
});

// Toggle month selector
function toggleMonthSelector() {
  monthSelectorOpen.value = !monthSelectorOpen.value;
}

// Close month selector
function closeMonthSelector() {
  monthSelectorOpen.value = false;
}

// Select a month
function selectMonth(monthIndex) {
  selectedMonthNum.value = monthIndex;
  updateSelectedMonth();
}

// Change year (does NOT trigger reload - user must click a month)
function changeYear(delta) {
  selectedYear.value += delta;
}

// Update the selectedMonth string (YYYY-MM format)
function updateSelectedMonth() {
  const month = String(selectedMonthNum.value + 1).padStart(2, "0");
  selectedMonth.value = `${selectedYear.value}-${month}`;
  emit("month-change", selectedMonth.value);
  closeMonthSelector();
}

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
    route: "/column-management",
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

// Provide selectedMonth to child route components via inject
provide("selectedMonth", selectedMonth);

const emit = defineEmits(["month-change"]);

function handleMonthChange(event) {
  selectedMonth.value = event.target.value;
  emit("month-change", selectedMonth.value);
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
    <!-- Top Header -->
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto">
        <!-- Top bar with logo, month selector, and user menu -->
        <div
          class="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8"
        >
          <!-- Logo and brand -->
          <div class="flex items-center gap-3">
            <div
              class="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md"
            >
              <svg
                class="w-6 h-6 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"
                />
              </svg>
            </div>
            <div>
              <h1 class="text-xl font-bold text-gray-900">Order Management</h1>
              <p class="text-xs text-gray-500 hidden sm:block">
                Manage your orders efficiently
              </p>
            </div>
          </div>

          <!-- Right side: month selector, connection status, and user menu -->
          <div class="flex items-center gap-4">
            <!-- Month selector (custom dropdown) -->
            <div class="hidden sm:block relative">
              <button
                @click="toggleMonthSelector"
                class="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <svg
                  class="w-4 h-4 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span class="text-sm font-medium text-gray-700">{{
                  selectedMonthDisplay
                }}</span>
                <svg
                  class="w-4 h-4 text-gray-400"
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

              <!-- Month picker dropdown -->
              <div
                v-if="monthSelectorOpen"
                class="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl ring-1 ring-black ring-opacity-5 z-50 overflow-hidden"
              >
                <!-- Year selector -->
                <div
                  class="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600"
                >
                  <button
                    @click="changeYear(-1)"
                    class="p-1 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors"
                  >
                    <svg
                      class="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                  <span class="text-lg font-bold text-white">{{
                    selectedYear
                  }}</span>
                  <button
                    @click="changeYear(1)"
                    class="p-1 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors"
                  >
                    <svg
                      class="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>

                <!-- Month grid -->
                <div class="p-3 grid grid-cols-3 gap-2">
                  <button
                    v-for="(month, index) in monthNames"
                    :key="month"
                    @click="selectMonth(index)"
                    :class="[
                      'px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                      selectedMonthNum === index &&
                      selectedYear === new Date().getFullYear()
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600',
                    ]"
                  >
                    {{ month }}
                  </button>
                </div>

                <!-- Quick actions -->
                <div class="px-3 pb-3 pt-1 border-t border-gray-100">
                  <button
                    @click="
                      selectedYear = new Date().getFullYear();
                      selectedMonthNum = new Date().getMonth();
                      updateSelectedMonth();
                    "
                    class="w-full px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    Go to Current Month
                  </button>
                </div>
              </div>
            </div>

            <!-- Connection status -->
            <div class="hidden md:block">
              <ConnectionStatus />
            </div>

            <!-- User menu -->
            <div class="relative">
              <button
                @click="toggleUserMenu"
                class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div
                  class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-md"
                >
                  {{ authStore.userName?.charAt(0)?.toUpperCase() || "U" }}
                </div>
                <div class="hidden md:block text-left">
                  <p
                    class="text-sm font-medium text-gray-900 max-w-[120px] truncate"
                  >
                    {{ authStore.userName || "User" }}
                  </p>
                  <p class="text-xs text-gray-500">
                    {{ authStore.userRole || "Unknown" }}
                  </p>
                </div>
                <svg
                  class="w-4 h-4 text-gray-500"
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
                class="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl ring-1 ring-black ring-opacity-5 z-50 overflow-hidden"
                @click.stop
              >
                <!-- User info header -->
                <div
                  class="px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500"
                >
                  <p class="text-sm font-semibold text-white truncate">
                    {{ authStore.userName || "User" }}
                  </p>
                  <p class="text-xs text-blue-100 truncate">
                    {{ authStore.userEmail }}
                  </p>
                  <div
                    class="mt-2 inline-flex items-center px-2 py-1 bg-white bg-opacity-20 rounded-full"
                  >
                    <span class="text-xs font-medium text-white">{{
                      authStore.userRole || "Unknown"
                    }}</span>
                  </div>
                </div>

                <!-- Menu items -->
                <div class="py-1">
                  <router-link
                    to="/profile"
                    class="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    @click="closeUserMenu"
                  >
                    <svg
                      class="w-5 h-5 text-gray-400"
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
                    <span>My Profile</span>
                  </router-link>

                  <button
                    @click="handleLogout"
                    class="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <svg
                      class="w-5 h-5"
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
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Mobile menu button -->
            <button
              @click="toggleMobileMenu"
              class="md:hidden p-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <svg
                class="w-6 h-6 text-gray-600"
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
          </div>
        </div>

        <!-- Navigation tabs (desktop) -->
        <nav
          class="hidden md:flex items-center gap-1 px-4 sm:px-6 lg:px-8 border-t border-gray-100"
        >
          <router-link
            v-for="item in visibleNavItems"
            :key="item.name"
            :to="item.route"
            :class="[
              'relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all',
              isActiveRoute(item.route)
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-t-lg',
            ]"
          >
            <span class="text-lg">{{ item.icon }}</span>
            <span>{{ item.name }}</span>
            <!-- Badge -->
            <span
              v-if="item.badge"
              class="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full"
            >
              {{ item.badge > 99 ? "99+" : item.badge }}
            </span>
          </router-link>
        </nav>

        <!-- Mobile navigation menu -->
        <div
          v-if="mobileMenuOpen"
          class="md:hidden border-t border-gray-200 bg-white relative z-50"
        >
          <nav class="px-4 py-3 space-y-1">
            <!-- Month selector (mobile) - Year navigation -->
            <div
              class="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-3 mb-3"
            >
              <div class="flex items-center justify-between mb-3">
                <button
                  @click="changeYear(-1)"
                  class="p-1.5 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-colors"
                >
                  <svg
                    class="w-4 h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <span class="text-lg font-bold text-white">{{
                  selectedYear
                }}</span>
                <button
                  @click="changeYear(1)"
                  class="p-1.5 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-colors"
                >
                  <svg
                    class="w-4 h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
              <!-- Month grid (mobile) -->
              <div class="grid grid-cols-4 gap-1.5">
                <button
                  v-for="(month, index) in monthNames"
                  :key="month"
                  @click="
                    selectMonth(index);
                    closeMobileMenu();
                  "
                  :class="[
                    'px-2 py-1.5 text-xs font-medium rounded-md transition-colors',
                    selectedMonthNum === index
                      ? 'bg-white text-blue-600'
                      : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30',
                  ]"
                >
                  {{ month }}
                </button>
              </div>
            </div>

            <!-- Navigation items -->
            <router-link
              v-for="item in visibleNavItems"
              :key="item.name"
              :to="item.route"
              @click="closeMobileMenu"
              :class="[
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActiveRoute(item.route)
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-50',
              ]"
            >
              <span class="text-xl">{{ item.icon }}</span>
              <span class="flex-1">{{ item.name }}</span>
              <!-- Badge -->
              <span
                v-if="item.badge"
                class="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full"
              >
                {{ item.badge > 99 ? "99+" : item.badge }}
              </span>
            </router-link>

            <!-- Connection status (mobile) -->
            <div class="pt-3 mt-3 border-t border-gray-200">
              <ConnectionStatus />
            </div>
          </nav>
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <router-view />
    </main>

    <!-- Click outside to close menus -->
    <div
      v-if="userMenuOpen || mobileMenuOpen || monthSelectorOpen"
      class="fixed inset-0 z-40"
      @click="
        closeUserMenu();
        closeMobileMenu();
        closeMonthSelector();
      "
    ></div>
  </div>
</template>
