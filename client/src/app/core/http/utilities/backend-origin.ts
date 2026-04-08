const trimTrailingSlash = (value: string): string => value.replace(/\/$/, '');

const hasDevProxyTarget = (): boolean => {
    if (!import.meta.env.DEV) {
        return false;
    }

    const proxyUrl = import.meta.env.VITE_PROXY_API_URL;
    return typeof proxyUrl === 'string' && proxyUrl.trim().length > 0;
};

const getConfiguredApiOrigin = (): string | null => {
    if (hasDevProxyTarget()) {
        return null;
    }

    const apiUrl = import.meta.env.VITE_API_URL;
    if (typeof apiUrl !== 'string' || apiUrl.trim().length === 0) {
        return null;
    }

    return trimTrailingSlash(apiUrl);
};

export const getBackendOrigin = (): string => {
    return getConfiguredApiOrigin() ?? window.location.origin;
};

export const buildBackendUrl = (path: string): string => {
    return new URL(path, `${getBackendOrigin()}/`).toString();
};
