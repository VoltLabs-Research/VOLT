let showErrorNotification: ((message: string, details?: any) => void) | null = null;

interface ErrorRecord {
    message: string;
    timestamp: number;
    count: number;
}

const errorHistory: ErrorRecord[] = [];
const MAX_HISTORY = 3;
const MAX_CONSECUTIVE_SAME_ERROR = 2;
const DEDUP_WINDOW_MS = 5000;

const shouldShowError = (message: string): boolean => {
    const now = Date.now();

    while (errorHistory.length > 0 && now - errorHistory[0].timestamp > DEDUP_WINDOW_MS) {
        errorHistory.shift();
    }

    let consecutiveCount = 0;
    for (let i = errorHistory.length - 1; i >= 0; i--) {
        if (errorHistory[i].message === message) {
            consecutiveCount++;
        } else {
            break;
        }
    }

    if (consecutiveCount >= MAX_CONSECUTIVE_SAME_ERROR) {
        return false;
    }

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

    if (errorHistory.length > MAX_HISTORY) {
        errorHistory.shift();
    }

    return true;
};

export const setErrorNotificationHandler = (handler: (message: string, details?: any) => void) => {
    showErrorNotification = handler;
};

export const clearErrorHistory = () => {
    errorHistory.length = 0;
};

export const notifyApiError = (error: any) => {
    if (!showErrorNotification) return;

    if (error.response?.status === 401 || error.response?.status === 403) {
        return;
    }

    const userMessage = error.getUserMessage();

    if (!shouldShowError(userMessage)) {
        console.warn('Duplicate error suppressed (shown 2+ times):', userMessage);
        return;
    }

    const details = {
        originalError: error.originalError?.message,
    };

    showErrorNotification(userMessage, details);
};

export default notifyApiError;
