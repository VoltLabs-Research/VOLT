import { endpointStorage } from './endpoint-storage';

const normalizeEndpoint = (endpoint: string | null | undefined): string | null => {
    const trimmed = endpoint?.trim();
    return trimmed ? trimmed.replace(/\/$/, '') : null;
};

const getEnvEndpoint = (): string | null => {
    return normalizeEndpoint(import.meta.env.VITE_SERVER_ENDPOINT);
};

/**
 * Endpoint injected by the deployment that serves this bundle, read at runtime.
 *
 * The single-machine stack serves the app from nginx, which reverse-proxies `/api`
 * and `/socket.io` on the same origin. Baking that origin in at build time would
 * mean one image per deployment, so the stack image instead injects
 * `window.__VOLT_SERVER_ENDPOINT__ = window.location.origin` into `index.html` and
 * one prebuilt image works for any host. Cloud builds never define the global and
 * keep using `VITE_SERVER_ENDPOINT`.
 */
const getRuntimeEndpoint = (): string | null => {
    return normalizeEndpoint(window.__VOLT_SERVER_ENDPOINT__);
};

const hasDevProxyTarget = (): boolean => {
    if (!import.meta.env.DEV) {
        return false;
    }

    return (import.meta.env.VITE_PROXY_API_URL?.trim().length ?? 0) > 0;
};

const resolveBackendEndpoint = (): string | null => {
    const stored = normalizeEndpoint(endpointStorage.getEndpoint());
    if (stored) {
        return stored;
    }

    const fromEnv = getEnvEndpoint();
    if (fromEnv) {
        return fromEnv;
    }

    const fromRuntime = getRuntimeEndpoint();
    if (fromRuntime) {
        return fromRuntime;
    }

    if (hasDevProxyTarget()) {
        return window.location.origin;
    }

    return null;
};

/**
 * True when the deployment dictates the endpoint, so the UI must not offer to
 * change it — whether it was pinned at build time or injected by the host serving
 * the bundle.
 */
export const isEndpointPinnedByEnv = (): boolean => {
    return getEnvEndpoint() !== null || getRuntimeEndpoint() !== null;
};

export const hasResolvedBackendEndpoint = (): boolean => {
    return resolveBackendEndpoint() !== null;
};

export const getBackendOrigin = (): string => {
    return resolveBackendEndpoint() ?? window.location.origin;
};

export const buildBackendUrl = (path: string): string => {
    return new URL(path, `${getBackendOrigin()}/`).toString();
};
