import type { CredentialProvider } from './CredentialProvider';

/**
 * Returns a credential provider backed by a static token.
 * Suitable for long-lived JWTs or API keys in server-side contexts.
 */
export const staticToken = (token: string): CredentialProvider => ({
    getToken: () => token
});

/**
 * Returns a credential provider for a VoltLabs secret key (`vsk_*` prefix).
 * Functionally identical to `staticToken` - the prefix validates on the server.
 * Prefer this preset over `staticToken` when working with secret keys to make
 * intent explicit in code.
 */
export const secretKey = (key: string): CredentialProvider => ({
    getToken: () => key
});

/**
 * Returns a credential provider backed by a callback.
 * Use this for JWTs stored in `localStorage`, in-memory stores, or any
 * context that requires async token refresh.
 *
 * @example
 * // Browser + localStorage
 * dynamicToken(() => localStorage.getItem('authToken'))
 *
 * @example
 * // Async token refresh
 * dynamicToken(async () => {
 *     const token = await tokenCache.getOrRefresh();
 *     return token;
 * })
 */
export const dynamicToken = (getter: () => string | null | Promise<string | null>): CredentialProvider => ({
    getToken: getter
});
