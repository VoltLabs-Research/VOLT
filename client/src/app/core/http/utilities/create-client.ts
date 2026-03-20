import { tokenStorage } from '@/shared/auth/token-storage';
import { createInstrumentedHttpClient, DEFAULT_HTTP_TIMEOUT_MS } from './client-instrumentation';
import { buildBackendUrl } from './backend-origin';
import { VoltClient, dynamicToken } from '@voltstack/voltclient';
import type { VoltClientOptions } from '@voltstack/voltclient';

export type CreateApiClientOptions = VoltClientOptions;

const getStoredToken = (): string | null => {
    return tokenStorage.getToken();
};

const credential = dynamicToken(getStoredToken);
const apiBaseUrl = buildBackendUrl('/api');

/**
 * Shared HTTP adapter for the frontend.
 * Kept app-side because some browser-only flows need raw HTTP access
 * without going through a scoped `VoltClient`.
 */
export const http = createInstrumentedHttpClient({
    baseUrl: apiBaseUrl,
    credential,
    timeout: DEFAULT_HTTP_TIMEOUT_MS
});

const rootApiClient = new VoltClient(http, '');

/**
 * Module-level RBAC teamId resolver used as a fallback for all RBAC-enabled clients.
 * Set once at app boot via `setGetTeamId`.
 */
let globalGetTeamId: (() => string | null) | undefined;

/**
 * Registers a global teamId resolver for RBAC-enabled API clients.
 * Call this once at app initialization (e.g., in `ProtectedRoute`).
 *
 * @example
 * setGetTeamId(() => useTeamStore.getState().selectedTeamId ?? null);
 */
export const setGetTeamId = (fn: () => string | null): void => {
    globalGetTeamId = fn;
};

/**
 * Creates a `VoltClient` scoped to a base path.
 * Reuses the shared SDK root client and only resolves app-owned RBAC state here.
 *
 * @example
 * const client = createApiClient('/container', { useRBAC: true });
 */
export const createApiClient = (basePath: string, opts?: CreateApiClientOptions): VoltClient => {
    const getTeamId = opts?.getTeamId ?? globalGetTeamId;

    if (!opts && !getTeamId) {
        return rootApiClient.withBasePath(basePath);
    }

    return rootApiClient.withBasePath(basePath, {
        ...opts,
        getTeamId
    });
};
