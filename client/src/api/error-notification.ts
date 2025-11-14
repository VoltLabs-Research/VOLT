/**
 * Show API error notifications
 * This is called from the API interceptor when an error occurs
 * Shows user-friendly messages to end users while logging full context for debugging
 * 
 * Implements error deduplication to avoid showing the same error multiple times
 */

let showErrorNotification: ((message: string, details?: any) => void) | null = null;

/**
 * Error history tracking for deduplication
 * Stores up to the last 3 errors to prevent showing the same error more than 2 times consecutively
 */
interface ErrorRecord {
  message: string;
  timestamp: number;
  count: number;
}

const errorHistory: ErrorRecord[] = [];
const MAX_HISTORY = 3;
const MAX_CONSECUTIVE_SAME_ERROR = 2;
const DEDUP_WINDOW_MS = 5000; // 5 second window for considering errors as consecutive

/**
 * Check if we should show this error or if it's a duplicate
 */
const shouldShowError = (message: string): boolean => {
  const now = Date.now();
  
  // Clean up old entries outside the dedup window
  while (errorHistory.length > 0 && now - errorHistory[0].timestamp > DEDUP_WINDOW_MS) {
    errorHistory.shift();
  }
  
  // Count consecutive occurrences of the same message
  let consecutiveCount = 0;
  for (let i = errorHistory.length - 1; i >= 0; i--) {
    if (errorHistory[i].message === message) {
      consecutiveCount++;
    } else {
      break;
    }
  }
  
  // If we've already shown this error 2 times consecutively, don't show it again
  if (consecutiveCount >= MAX_CONSECUTIVE_SAME_ERROR) {
    return false;
  }
  
  // Update history or add new entry
  const lastEntry = errorHistory[errorHistory.length - 1];
  if (lastEntry && lastEntry.message === message && now - lastEntry.timestamp < DEDUP_WINDOW_MS) {
    lastEntry.count++;
    lastEntry.timestamp = now;
  } else {
    errorHistory.push({
      message,
      timestamp: now,
      count: 1
    });
  }
  
  // Keep history size manageable
  if (errorHistory.length > MAX_HISTORY) {
    errorHistory.shift();
  }
  
  return true;
};

export const setErrorNotificationHandler = (handler: (message: string, details?: any) => void) => {
  showErrorNotification = handler;
};

/**
 * Clear error history - useful when user navigates away or session changes
 */
export const clearErrorHistory = () => {
  errorHistory.length = 0;
};

export const notifyApiError = (error: any) => {
  if (!showErrorNotification) return;

  // Don't notify for certain status codes that are handled separately
  if (error.response?.status === 401 || error.response?.status === 403) {
    return; // Auth errors are handled separately by the app
  }

  // Use user-friendly message for UI
  const userMessage = error.getUserMessage();
  
  // Check if we should show this error
  if (!shouldShowError(userMessage)) {
    // Log to console that we're suppressing this duplicate error
    console.warn('Duplicate error suppressed (shown 2+ times):', userMessage);
    return;
  }
  
  // Keep technical details for debugging only
  const details = {
    originalError: error.originalError?.message,
  };

  showErrorNotification(userMessage, details);
};

export default notifyApiError;
