import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // Getters
  const isAuthenticated = computed(() => !!user.value)
  const userEmail = computed(() => user.value?.email || '')
  const userName = computed(() => user.value?.displayName || user.value?.email?.split('@')[0] || '')
  const userRole = computed(() => user.value?.role || 'user')

  // Actions
  function setUser(userData) {
    user.value = userData
    error.value = null
  }

  function setLoading(isLoading) {
    loading.value = isLoading
  }

  function setError(errorMessage) {
    error.value = errorMessage
  }

  function clearUser() {
    user.value = null
    error.value = null
  }

  async function login(email, password) {
    // TODO: Implement Firebase Auth login
    setLoading(true)
    try {
      // Placeholder for Firebase Auth
      console.log('Login attempt:', email)
      setError(null)
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    // TODO: Implement Firebase Auth logout
    setLoading(true)
    try {
      clearUser()
    } finally {
      setLoading(false)
    }
  }

  async function register(email, password, displayName) {
    // TODO: Implement Firebase Auth registration
    setLoading(true)
    try {
      console.log('Register attempt:', email, displayName)
      setError(null)
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
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
    // Actions
    setUser,
    setLoading,
    setError,
    clearUser,
    login,
    logout,
    register
  }
})
