/**
 * Public base URL of this server, preferring an explicit SERVER_ENDPOINT and
 * falling back to schema + hostname.
 */
export const resolveServerBaseUrl = (): string => {
    const configuredServerUrl = process.env.SERVER_ENDPOINT?.trim();
    if(configuredServerUrl) return configuredServerUrl.replace(/\/+$/g, '');

    const protocol = process.env.SERVER_SCHEMA?.trim() || 'http';
    const host = process.env.SERVER_HOSTNAME?.trim() || 'localhost';
    return `${protocol}://${host}`;
};
