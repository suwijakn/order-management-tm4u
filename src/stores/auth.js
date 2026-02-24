
import { defineStore } from "pinia";
import { computed } from "vue";
import { useAuth } from "@/composables/useAuth";

export const useAuthStore = defineStore("auth", () => {
  // Use the auth composable
  const {
    currentUser,
    loading,
    error,
    login: authLogin,
    register: authRegister,
    logout: authLogout,
    initAuthListener,
    isEmailVerified,
    sendVerificationEmail,
  } = useAuth();

  // Getters
  const user = computed(() => currentUser.value);
  const isAuthenticated = computed(() => !!currentUser.value);
  const userEmail = computed(() => currentUser.value?.email || "");
  const userName = computed(
    () =>
      currentUser.value?.displayName ||
      currentUser.value?.email?.split("@")[0] ||
      "",
  );
  const userRole = computed(() => currentUser.value?.role || "user");
  const emailVerified = computed(() => isEmailVerified());

  // Actions
  function setUser(userData) {
    user.value = userData;
    error.value = null;
  }

  function setLoading(isLoading) {
    loading.value = isLoading;
  }

  function setError(errorMessage) {
    error.value = errorMessage;
  }

  function clearError() {
    error.value = null;
  }

  function clearUser() {
    user.value = null;
    error.value = null;
  }

  async function login(email, password, rememberMe = false) {
    try {
      const user = await authLogin(email, password, rememberMe);
      return user;
    } catch (err) {
      throw err;
    }
  }

  async function logout() {
    try {
      await authLogout();
    } catch (err) {
      throw err;
    }
  }

  async function register(email, password, displayName) {
    try {
      const user = await authRegister(email, password, displayName);
      return user;
    } catch (err) {
      throw err;
    }
  }

  async function resendVerificationEmail() {
    try {
      await sendVerificationEmail();
    } catch (err) {
      throw err;
    }
  }

  return {
    // State
    user,
    loading,
    error,
    // Getters
    isAuthenticated,
    userEmail,
    userName,
    userRole,
    emailVerified,
    // Actions
    setUser,
    setLoading,
    setError,
    clearError,
    clearUser,
    login,
    logout,
    register,
    resendVerificationEmail,
  };
});
