import type { HttpQuery } from './HttpClient';

/**
 * Maps HTTP status codes to fallback error codes.
 * Used by both `AxiosHttpClient` and `FetchHttpClient` when the server
 * does not return a structured error body.
 */
export const getHttpFallbackCode = (status: number): string => {
    if (status === 400) return 'Http::400';
    if (status === 401) return 'Http::401';
    if (status === 403) return 'Http::403';
    if (status === 404) return 'Http::404';
    if (status === 409) return 'Http::409';
    if (status === 429) return 'Http::429';
    if (status === 500) return 'Http::500';
    if (status === 502) return 'Http::502';
    if (status === 503) return 'Http::503';
    if (status === 504) return 'Http::504';
    return 'Internal::Server::Error';
};

/**
 * Converts an `HttpQuery` object into a `URLSearchParams` instance,
 * skipping `null` and `undefined` values and appending array entries individually.
 */
export const toParams = (query?: HttpQuery): URLSearchParams | undefined => {
    if (!query) return undefined;

    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;

        if (Array.isArray(v)) {
            v.forEach((x) => params.append(k, String(x)));
        } else {
            params.set(k, String(v));
        }
    }

    return params;
};
