import { endpointStorage } from './endpoint-storage';

const trimTrailingSlash = (value: string): string => value.replace(/\/$/, '');

const hasDevProxyTarget = (): boolean => {
    if (!import.meta.env.DEV) {
        return false;
    }

    const proxyUrl = import.meta.env.VITE_PROXY_API_URL;
    return typeof proxyUrl === 'string' && proxyUrl.trim().length > 0;
};

const getEnvEndpoint = (): string | null => {
    const endpoint = import.meta.env.VITE_SERVER_ENDPOINT;
    if (typeof endpoint !== 'string' || endpoint.trim().length === 0) {
        return null;
    }

    return trimTrailingSlash(endpoint.trim());
};

const getStoredEndpoint = (): string | null => {
    const endpoint = endpointStorage.getEndpoint();
    if (typeof endpoint !== 'string' || endpoint.trim().length === 0) {
        return null;
    }

    return trimTrailingSlash(endpoint.trim());
};

const resolveBackendEndpoint = (): string | null => {
    const stored = getStoredEndpoint();
    if (stored) {
        return stored;
    }

    const fromEnv = getEnvEndpoint();
    if (fromEnv) {
        return fromEnv;
    }

    if (hasDevProxyTarget()) {
        return window.location.origin;
    }

    return null;
};

export const isEndpointPinnedByEnv = (): boolean => {
    return getEnvEndpoint() !== null;
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
