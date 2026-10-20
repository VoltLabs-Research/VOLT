import { tokenStorage } from '@/shared/auth/token-storage';
import { createInstrumentedHttpClient, DEFAULT_HTTP_TIMEOUT_MS } from './client-instrumentation';
import { buildBackendUrl } from './backend-origin';
import { VoltClient, dynamicToken } from '@voltstack/voltclient';
import type { VoltClientOptions } from '@voltstack/voltclient';

const credential = dynamicToken(() => tokenStorage.getToken());
const apiBaseUrl = buildBackendUrl('/api');

export const http = createInstrumentedHttpClient({
    baseUrl: apiBaseUrl,
    credential,
    timeout: DEFAULT_HTTP_TIMEOUT_MS
});

const rootApiClient = new VoltClient(http, '');

let globalGetTeamId: (() => string | null) | undefined;

export const setGetTeamId = (fn: () => string | null): void => {
    globalGetTeamId = fn;
};

export const createApiClient = (basePath: string, opts?: VoltClientOptions): VoltClient => {
    const getTeamId = opts?.getTeamId ?? globalGetTeamId;

    if (!opts && !getTeamId) {
        return rootApiClient.withBasePath(basePath);
    }

    return rootApiClient.withBasePath(basePath, {
        ...opts,
        getTeamId
    });
};
