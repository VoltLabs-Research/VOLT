const FRACTAL_DEBUG_PREFIX = '[fractal-debug]';

const isDevLoggingEnabled = (): boolean => {
    return import.meta.env.DEV;
};

export const debugFractal = (
    event: string,
    metadata?: Record<string, unknown>
): void => {
    if (!isDevLoggingEnabled()) {
        return;
    }

    console.debug(`${FRACTAL_DEBUG_PREFIX} ${event}`, metadata ?? {});
};

export const warnFractal = (
    event: string,
    metadata?: Record<string, unknown>
): void => {
    console.warn(`${FRACTAL_DEBUG_PREFIX} ${event}`, metadata ?? {});
};
