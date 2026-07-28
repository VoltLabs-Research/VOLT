export interface IdleCallbackHandle {
    cancel: () => void;
}

interface IdleCallbackOptions {
    timeoutMs?: number;
    fallbackDelayMs?: number;
}

const DEFAULT_IDLE_TIMEOUT_MS = 1500;

export const requestIdleCallbackHandle = (
    onIdle: () => void,
    { timeoutMs = DEFAULT_IDLE_TIMEOUT_MS, fallbackDelayMs = timeoutMs }: IdleCallbackOptions = {}
): IdleCallbackHandle => {
    if (typeof window.requestIdleCallback === 'function') {
        const idleCallbackId = window.requestIdleCallback(onIdle, { timeout: timeoutMs });

        return {
            cancel: () => {
                window.cancelIdleCallback(idleCallbackId);
            }
        };
    }

    const timeoutId = window.setTimeout(onIdle, fallbackDelayMs);

    return {
        cancel: () => {
            window.clearTimeout(timeoutId);
        }
    };
};
