/**
 * Error handling utility for T-INFO-003: Generic error messages
 * 
 * Prevents information leakage by showing generic messages to users
 * while logging detailed errors to console for debugging.
 */

/**
 * Error categories mapped to user-friendly messages
 */
const ERROR_MESSAGES = {
  // Authentication errors
  'auth/user-not-found': 'Invalid email or password.',
  'auth/wrong-password': 'Invalid email or password.',
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
  'auth/network-request-failed': 'Network error. Please check your connection.',
  
  // Permission errors
  'permission-denied': 'You do not have permission to perform this action.',
  'PERMISSION_DENIED': 'You do not have permission to perform this action.',
  
  // Data errors
  'not-found': 'The requested item was not found.',
  'already-exists': 'This item already exists.',
  'failed-precondition': 'Operation failed. Please try again.',
  
  // Network errors
  'unavailable': 'Service temporarily unavailable. Please try again.',
  'deadline-exceeded': 'Request timed out. Please try again.',
  
  // Default
  'default': 'An error occurred. Please try again or contact support.'
};

/**
 * Maps Firebase/Firestore error codes to user-friendly messages
 * @param {Error} error - The error object
 * @returns {string} User-friendly error message
 */
export function getUserMessage(error) {
  if (!error) {
    return ERROR_MESSAGES.default;
  }

  // Extract error code from various error formats
  const errorCode = error.code || error.message || '';
  
  // Check for known error codes
  for (const [code, message] of Object.entries(ERROR_MESSAGES)) {
    if (errorCode.includes(code)) {
      return message;
    }
  }

  // Return default message
  return ERROR_MESSAGES.default;
}

/**
 * Logs detailed error information to console (for debugging)
 * while returning a generic message for the user
 * 
 * @param {Error} error - The error object
 * @param {string} context - Context where the error occurred (e.g., 'orders.createOrder')
 * @returns {string} User-friendly error message
 */
export function handleError(error, context = 'Unknown') {
  // Log detailed error for debugging
  console.error(`[${context}] Error:`, {
    message: error.message,
    code: error.code,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });

  // Return generic message for user
  return getUserMessage(error);
}

/**
 * Wraps an async function with error handling
 * @param {Function} fn - Async function to wrap
 * @param {string} context - Context for error logging
 * @returns {Function} Wrapped function
 */
export function withErrorHandling(fn, context) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      const userMessage = handleError(error, context);
      throw new Error(userMessage);
    }
  };
}

/**
 * Validation error - shows specific message to user
 * (These are safe to show as they don't leak system info)
 */
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.isUserFacing = true;
  }
}

/**
 * Checks if an error is user-facing (safe to display)
 * @param {Error} error 
 * @returns {boolean}
 */
export function isUserFacingError(error) {
  return error instanceof ValidationError || error.isUserFacing === true;
}
