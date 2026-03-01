import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useAuth } from "@/composables/useAuth";

// Views
import LoginView from "@/views/LoginView.vue";
import RegisterView from "@/views/RegisterView.vue";
import DashboardView from "@/views/DashboardView.vue";
import EmailVerificationView from "@/views/EmailVerificationView.vue";
import PendingReviewView from "@/views/PendingReviewView.vue";
import TestOrderCreate from "@/views/TestOrderCreate.vue";

const routes = [
  {
    path: "/",
    redirect: "/dashboard",
  },
  {
    path: "/login",
    name: "Login",
    component: LoginView,
    meta: { requiresGuest: false },
  },
  {
    path: "/register",
    name: "Register",
    component: RegisterView,
    meta: { requiresGuest: true },
  },
  {
    path: "/forgot-password",
    name: "ForgotPassword",
    component: () => import("@/views/ForgotPasswordView.vue"),
    meta: { requiresGuest: true },
  },
  {
    path: "/verify-email",
    name: "EmailVerification",
    component: EmailVerificationView,
    meta: { requiresAuth: true, requiresEmailVerification: false },
  },
  {
    path: "/dashboard",
    name: "Dashboard",
    component: DashboardView,
    meta: { requiresAuth: true, requiresEmailVerification: true },
  },
  {
    path: "/test-order-create",
    name: "TestOrderCreate",
    component: TestOrderCreate,
    meta: { requiresAuth: true, requiresEmailVerification: true },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

// Navigation guards
router.beforeEach(async (to, from, next) => {
  const { authReady } = useAuth();

  // Wait for Firebase to finish restoring auth state before checking
  await authReady;

  const authStore = useAuthStore();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: "Login", query: { redirect: to.fullPath } });
  } else if (to.meta.requiresGuest && authStore.isAuthenticated) {
    // If authenticated but not verified, go to verification page
    if (!authStore.emailVerified) {
      next({ name: "EmailVerification" });
    } else {
      next({ name: "Dashboard" });
    }
  } else if (to.meta.requiresEmailVerification && !authStore.emailVerified) {
    next({ name: "EmailVerification" });
  } else if (to.meta.requiresJrSalesAbove && authStore.isAuthenticated) {
    // Check if user has jr_sales role or above
    // For now, allow all authenticated users (role check will be done in components)
    // TODO: Implement proper role checking once custom claims are loaded
    next();
  } else {
    next();
  }
});

export default router;
