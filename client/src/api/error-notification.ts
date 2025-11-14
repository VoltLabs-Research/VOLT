/**
 * Show API error notifications
 * This is called from the API interceptor when an error occurs
 */

let showErrorNotification: ((message: string, details?: any) => void) | null = null;

export const setErrorNotificationHandler = (handler: (message: string, details?: any) => void) => {
  showErrorNotification = handler;
};

export const notifyApiError = (error: any) => {
  if (!showErrorNotification) return;

  // Don't notify for certain status codes that are handled separately
  if (error.response?.status === 401 || error.response?.status === 403) {
    return; // Auth errors are handled separately
  }

  const message = error.getDetailedMessage?.() || error.message || 'An error occurred';
  const details = {
    context: error.context,
    originalError: error.originalError?.message
  };

  showErrorNotification(message, details);
};

export default notifyApiError;
