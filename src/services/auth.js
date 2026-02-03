// Auth service - Firebase Authentication wrapper
// TODO: Implement actual Firebase Auth methods

import { auth } from './firebase'
import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth'

/**
 * Sign in with email and password
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<UserCredential>}
 */
export async function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password)
}

/**
 * Sign out the current user
 * @returns {Promise<void>}
 */
export async function logout() {
  return signOut(auth)
}

/**
 * Create a new user account
 * @param {string} email 
 * @param {string} password 
 * @param {string} displayName 
 * @returns {Promise<UserCredential>}
 */
export async function register(email, password, displayName) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password)
  if (displayName) {
    await updateProfile(userCredential.user, { displayName })
  }
  return userCredential
}

/**
 * Subscribe to auth state changes
 * @param {Function} callback 
 * @returns {Function} Unsubscribe function
 */
export function subscribeToAuthState(callback) {
  return onAuthStateChanged(auth, callback)
}

/**
 * Get the current user
 * @returns {User|null}
 */
export function getCurrentUser() {
  return auth.currentUser
}
