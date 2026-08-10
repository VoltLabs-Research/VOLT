import FetchHttpClient from '../core/FetchHttpClient';
import AxiosHttpClient from '../core/AxiosHttpClient';
import VoltClient from '../core/VoltClient';
import type { CredentialProvider } from '../auth/CredentialProvider';
import type { VoltClientOptions } from '../core/VoltClient';

export interface VoltClientFactoryOptions {
    /**
     * Credential provider for authentication.
     * If omitted, requests are sent without an `Authorization` header.
     */
    credential?: CredentialProvider;
    /**
     * HTTP adapter to use.
     * - `'fetch'` (default): native fetch - no extra dependencies, Node 18+.
     * - `'axios'`: Axios adapter - required for upload progress reporting.
     */
    adapter?: 'fetch' | 'axios';
    /** Request timeout in milliseconds. Default: 30 000. */
    timeout?: number;
    /** Global RBAC team ID scope. Passed to every client created via `withBasePath`. */
    teamId?: string;
};

/**
 * Creates a `VoltClient` scoped to the given `baseUrl`.
 *
 * The returned instance can be further scoped to sub-paths via `withBasePath`:
 * ```ts
 * const root = createVoltClient('https://api.example.com/api', {
 *     credential: staticToken('vsk_xxx')
 * });
 * const containers = root.withBasePath('/container', { useRBAC: true, getTeamId });
 * ```
 *
 * @param baseUrl - Full base URL of the API (e.g. `https://api.example.com/api`).
 * @param options - Optional factory configuration.
 */
export const createVoltClient = (
    baseUrl: string,
    options: VoltClientFactoryOptions = {}
): VoltClient => {
    const { credential, adapter = 'fetch', timeout, teamId } = options;

    const httpOpts = { baseUrl, credential, timeout };

    const http =
        adapter === 'axios'
            ? new AxiosHttpClient(httpOpts)
            : new FetchHttpClient(httpOpts);

    const clientOpts: VoltClientOptions = teamId
        ? { useRBAC: true, getTeamId: () => teamId }
        : {};

    return new VoltClient(http, '', clientOpts);
};
