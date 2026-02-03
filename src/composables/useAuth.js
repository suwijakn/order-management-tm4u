import { ref } from "vue";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendEmailVerification,
} from "firebase/auth";
import { auth } from "@/services/firebase";

// Shared reactive state across all component instances
const currentUser = ref(null);
const loading = ref(true);
const error = ref(null);

let unsubscribe = null;

// Rate limiting constants (T-AUTH-002: 5 attempts/15min)
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_STORAGE_KEY = "tm4u_auth_attempts";

// Session timeout constants (T-AUTH-003)
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_ABSOLUTE_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_REMEMBER_ME_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_STORAGE_KEY = "tm4u_session_info";

export function useAuth() {
  // Initialize auth state listener
  function initAuthListener() {
    if (unsubscribe) return; // Already listening

    unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        currentUser.value = user;
        loading.value = false;

        // Check session validity on auth state change
        if (user) {
          checkSessionValidity();
        }
      },
      (err) => {
        error.value = err.message;
        loading.value = false;
      },
    );
  }

  // Cleanup auth state listener
  function cleanupAuthListener() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  // Rate limiting functions (T-AUTH-002)
  function getAttemptData() {
    try {
      const data = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
      if (!data) return { attempts: [], lockoutUntil: null };
      return JSON.parse(data);
    } catch {
      return { attempts: [], lockoutUntil: null };
    }
  }

  function saveAttemptData(data) {
    localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(data));
  }

  function checkRateLimit() {
    const now = Date.now();
    const data = getAttemptData();

    // Check if currently locked out
    if (data.lockoutUntil && now < data.lockoutUntil) {
      const remainingMs = data.lockoutUntil - now;
      return {
        allowed: false,
        remainingMinutes: Math.ceil(remainingMs / 60000),
      };
    }

    // Filter attempts within the window
    const recentAttempts = data.attempts.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
    );

    if (recentAttempts.length >= RATE_LIMIT_MAX_ATTEMPTS) {
      // Set lockout
      const lockoutUntil = now + RATE_LIMIT_WINDOW_MS;
      saveAttemptData({ attempts: recentAttempts, lockoutUntil });
      return {
        allowed: false,
        remainingMinutes: Math.ceil(RATE_LIMIT_WINDOW_MS / 60000),
      };
    }

    return { allowed: true, remainingMinutes: 0 };
  }

  function recordFailedAttempt() {
    const now = Date.now();
    const data = getAttemptData();

    // Filter and add new attempt
    const recentAttempts = data.attempts.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
    );
    recentAttempts.push(now);

    saveAttemptData({
      attempts: recentAttempts,
      lockoutUntil: data.lockoutUntil,
    });
  }

  function clearFailedAttempts() {
    localStorage.removeItem(RATE_LIMIT_STORAGE_KEY);
  }

  function getFailedAttempts() {
    const now = Date.now();
    const data = getAttemptData();
    return data.attempts.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
    ).length;
  }

  // Session management functions (T-AUTH-003, T-AUTH-004)
  function createSessionInfo(rememberMe) {
    const now = Date.now();
    const sessionInfo = {
      createdAt: now,
      lastActivity: now,
      rememberMe: rememberMe,
      absoluteExpiry: rememberMe
        ? now + SESSION_REMEMBER_ME_TIMEOUT_MS
        : now + SESSION_ABSOLUTE_TIMEOUT_MS,
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionInfo));
    return sessionInfo;
  }

  function updateSessionActivity() {
    try {
      const data = localStorage.getItem(SESSION_STORAGE_KEY);
      if (data) {
        const sessionInfo = JSON.parse(data);
        sessionInfo.lastActivity = Date.now();
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionInfo));
      }
    } catch {
      // Ignore errors
    }
  }

  function checkSessionValidity() {
    try {
      const data = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!data) return true; // No session info, allow

      const sessionInfo = JSON.parse(data);
      const now = Date.now();

      // Check absolute expiry
      if (now > sessionInfo.absoluteExpiry) {
        logout();
        return false;
      }

      // Check idle timeout (only if not remember me)
      if (!sessionInfo.rememberMe) {
        const idleTime = now - sessionInfo.lastActivity;
        if (idleTime > SESSION_IDLE_TIMEOUT_MS) {
          logout();
          return false;
        }
      }

      return true;
    } catch {
      return true;
    }
  }

  function clearSessionInfo() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }

  // Login with email and password
  async function login(email, password, rememberMe = false) {
    error.value = null;
    loading.value = true;
    try {
      // Set persistence based on remember me (T-AUTH-003)
      const persistence = rememberMe
        ? browserLocalPersistence
        : browserSessionPersistence;
      await setPersistence(auth, persistence);

      const rateLimitResult = checkRateLimit();
      if (!rateLimitResult.allowed) {
        error.value = `Too many failed attempts. Please try again after ${rateLimitResult.remainingMinutes} minutes.`;
        throw new Error(error.value);
      }

      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );

      // Create session info for timeout tracking
      createSessionInfo(rememberMe);

      return userCredential.user;
    } catch (err) {
      recordFailedAttempt();
      error.value = getAuthErrorMessage(err.code);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Register new user
  async function register(email, password, displayName = null) {
    error.value = null;
    loading.value = true;
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );

      // Update display name if provided
      if (displayName) {
        await updateProfile(userCredential.user, { displayName });
      }

      // Send email verification
      await sendEmailVerification(userCredential.user);

      return userCredential.user;
    } catch (err) {
      error.value = getAuthErrorMessage(err.code);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Logout current user
  async function logout() {
    error.value = null;
    loading.value = true;
    try {
      clearSessionInfo();
      await signOut(auth);
    } catch (err) {
      error.value = getAuthErrorMessage(err.code);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Map Firebase error codes to user-friendly messages
  function getAuthErrorMessage(errorCode) {
    const errorMessages = {
      "auth/invalid-email": "Invalid email address format.",
      "auth/user-disabled": "This account has been disabled.",
      "auth/user-not-found": "No account found with this email.",
      "auth/wrong-password": "Incorrect password.",
      "auth/invalid-credential": "Invalid email or password.",
      "auth/email-already-in-use": "An account already exists with this email.",
      "auth/weak-password": "Password should be at least 6 characters.",
      "auth/too-many-requests":
        "Too many failed attempts. Please try again later.",
      "auth/network-request-failed":
        "Network error. Please check your connection.",
    };
    return errorMessages[errorCode] || "An authentication error occurred.";
  }

  // Initialize auth listener on first use
  if (!unsubscribe) {
    initAuthListener();
  }

  return {
    currentUser,
    loading,
    error,
    login,
    register,
    logout,
    initAuthListener,
    cleanupAuthListener,
    // Rate limiting exports
    checkRateLimit,
    recordFailedAttempt,
    clearFailedAttempts,
    getFailedAttempts,
    // Session management exports
    updateSessionActivity,
    checkSessionValidity,
  };
}
