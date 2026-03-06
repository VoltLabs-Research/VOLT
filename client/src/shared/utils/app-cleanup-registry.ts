export type AppCleanupReason = 'route-change' | 'error-recovery' | 'manual-reset';

export interface AppCleanupContext {
    reason: AppCleanupReason;
    previousPathname: string | null;
    nextPathname: string | null;
}

export type AppCleanupHandler = (context: AppCleanupContext) => void;

const cleanupRegistry: Record<AppCleanupReason, Set<AppCleanupHandler>> = {
    'route-change': new Set<AppCleanupHandler>(),
    'error-recovery': new Set<AppCleanupHandler>(),
    'manual-reset': new Set<AppCleanupHandler>()
};

const registerCleanup = (
    handler: AppCleanupHandler,
    reasons: AppCleanupReason[]
): (() => void) => {
    reasons.forEach((reason) => {
        cleanupRegistry[reason].add(handler);
    });

    return () => {
        reasons.forEach((reason) => {
            cleanupRegistry[reason].delete(handler);
        });
    };
};

const runCleanup = (context: AppCleanupContext): void => {
    cleanupRegistry[context.reason].forEach((handler) => {
        try {
            handler(context);
        } catch {
        }
    });
};

export const registerRouteCleanup = (handler: AppCleanupHandler): (() => void) => {
    return registerCleanup(handler, ['route-change']);
};

export const registerErrorRecoveryCleanup = (handler: AppCleanupHandler): (() => void) => {
    return registerCleanup(handler, ['error-recovery']);
};

export const registerSharedAppCleanup = (handler: AppCleanupHandler): (() => void) => {
    return registerCleanup(handler, ['route-change', 'error-recovery', 'manual-reset']);
};

export const runRouteCleanup = (
    previousPathname: string,
    nextPathname: string
): void => {
    runCleanup({
        reason: 'route-change',
        previousPathname,
        nextPathname
    });
};

export const runErrorRecoveryCleanup = (
    previousPathname: string | null,
    nextPathname: string | null = '/error'
): void => {
    runCleanup({
        reason: 'error-recovery',
        previousPathname,
        nextPathname
    });
};

export const runManualAppCleanup = (
    previousPathname: string | null,
    nextPathname: string | null = null
): void => {
    runCleanup({
        reason: 'manual-reset',
        previousPathname,
        nextPathname
    });
};
