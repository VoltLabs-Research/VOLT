import { endpointStorage } from './endpoint-storage';

const normalizeEndpoint = (endpoint: string | null | undefined): string | null => {
    const trimmed = endpoint?.trim();
    return trimmed ? trimmed.replace(/\/$/, '') : null;
};

const getEnvEndpoint = (): string | null => {
    return normalizeEndpoint(import.meta.env.VITE_SERVER_ENDPOINT);
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
