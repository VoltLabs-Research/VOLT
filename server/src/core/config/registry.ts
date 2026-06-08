export const DEFAULT_REGISTRY_URL = 'https://registry.voltcloud.dev';

export const getRegistryUrl = (): string => {
    const value = process.env.REGISTRY_URL?.trim();
    return value && value.length > 0 ? value.replace(/\/+$/, '') : DEFAULT_REGISTRY_URL;
};
