export type AppCleanupReason = 'route-change' | 'error-recovery' | 'manual-reset';

export interface AppCleanupContext {
    reason: AppCleanupReason;
    previousPathname: string | null;
    nextPathname: string | null;
};

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

export const registerErrorRecoveryCleanup = (handler: AppCleanupHandler): (() => void) => {
    return registerCleanup(handler, ['error-recovery']);
};

export const registerSharedAppCleanup = (handler: AppCleanupHandler): (() => void) => {
    return registerCleanup(handler, ['route-change', 'error-recovery', 'manual-reset']);
};

export const registerManualAppCleanup = (handler: AppCleanupHandler): (() => void) => {
    return registerCleanup(handler, ['manual-reset']);
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

/**
 * Query-key prefixes registered by each WebSocket-managed module.
 * These prefixes survive a team switch (their data is fed by sockets,
 * not REST refetches, so clearing them would leave caches permanently empty).
 *
 * Modules call {@link registerPreservedQueryKey} at module-init time.
 * {@link useTeamStore} reads the set at team-switch time via
 * {@link getPreservedQueryPrefixes}.
 */
const preservedQueryPrefixes = new Set<string>();

/**
 * Registers a query-key prefix that must survive a team switch.
 * Call this at the top level of any module whose query data is
 * driven by a WebSocket subscription rather than a REST refetch.
 *
 * @param prefix - The first element of the query key array (e.g. `'cluster'`).
 */
export const registerPreservedQueryKey = (prefix: string): void => {
    preservedQueryPrefixes.add(prefix);
};

/** Returns the current set of preserved query-key prefixes as a readonly array. */
export const getPreservedQueryPrefixes = (): readonly string[] => {
    return [...preservedQueryPrefixes];
};
