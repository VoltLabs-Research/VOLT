import TokenStorage from '@/shared/auth/token-storage';
import { AxiosHttpClient, VoltClient, dynamicToken } from '@voltstack/voltclient';

interface CreateApiClientOptions {
    useRBAC?: boolean;
    getTeamId?: () => string | null;
};

/**
 * Shared Axios HTTP adapter for the frontend.
 * Reads the API base URL from the Vite environment and delegates token
 * resolution to `TokenStorage` (localStorage-backed).
 *
 * This is the only place in the frontend that references `import.meta.env`
 * and `localStorage` for HTTP auth - all other HTTP code lives in
 * `@voltstack/voltclient` and is environment-agnostic.
 */
export const http = new AxiosHttpClient({
    baseUrl: import.meta.env.VITE_API_URL + '/api',
    credential: dynamicToken(() => new TokenStorage().getToken())
});

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
 * When no `getTeamId` is provided, falls back to the global resolver
 * set via `setGetTeamId`.
 *
 * @example
 * const client = createApiClient('/container', { useRBAC: true });
 */
export const createApiClient = (basePath: string, opts?: CreateApiClientOptions): VoltClient => {
    return new VoltClient(http, basePath, {
        ...opts,
        getTeamId: opts?.getTeamId ?? globalGetTeamId
    });
};
