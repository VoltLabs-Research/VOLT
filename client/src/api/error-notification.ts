/**
 * Show API error notifications
 * This is called from the API interceptor when an error occurs
 */

let showErrorNotification: ((message: string) => void) | null = null;

export const setErrorNotificationHandler = (handler: (message: string) => void) => {
  showErrorNotification = handler;
};

export const notifyApiError = (error: any) => {
  if (!showErrorNotification) return;

  const message = error.message || 'An error occurred';

  // Don't notify for certain status codes that are handled silently
  if (error.response?.status === 401 || error.response?.status === 403) {
    return; // Auth errors are handled separately
  }

  showErrorNotification(message);
};

export default notifyApiError;
