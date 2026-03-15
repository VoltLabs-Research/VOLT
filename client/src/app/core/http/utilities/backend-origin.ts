const trimTrailingSlash = (value: string): string => value.replace(/\/$/, '');

const getConfiguredApiOrigin = (): string | null => {
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
