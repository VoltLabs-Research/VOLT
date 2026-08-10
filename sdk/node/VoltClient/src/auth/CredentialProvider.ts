/**
 * Abstraction for credential resolution.
 * Implementations return a Bearer token (JWT, secret key, etc.)
 * or null if no auth should be sent.
 *
 * Supports both sync and async resolution to allow token refresh flows.
 */
export interface CredentialProvider {
    getToken(): string | null | Promise<string | null>;
};
