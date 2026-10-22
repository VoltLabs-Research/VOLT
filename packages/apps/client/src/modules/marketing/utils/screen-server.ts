import { http } from '@/app/core/http/utils/create-client';
import type { HttpMethod, HttpQuery, HttpRequest } from '@voltstack/voltclient';

export interface ScreenRequest {
    params: Record<string, string>;
    query: URLSearchParams;
    body: unknown;
}

// What the server would answer, by method and path; `:name` matches one segment of it. An
// answer of undefined leaves the request to the routes after it.
export type ScreenRoute = [method: HttpMethod, path: string, answer: (request: ScreenRequest) => unknown];

const API_PATH = '/api';

const toQuery = (url: URL, query: HttpQuery | undefined): URLSearchParams => {
    const merged = new URLSearchParams(url.search);
    for (const [key, value] of Object.entries(query ?? {})) {
        if (value !== undefined && value !== null) {
            merged.set(key, String(value));
        }
    }
    return merged;
};

// The client asks relative to the API, except for models, which it asks for by full URL.
const toApiUrl = (url: string): URL => {
    if (/^[a-z][a-z\d+.-]*:/i.test(url)) {
        return new URL(url);
    }
    return new URL(`${API_PATH}/${url.replace(/^\/+/, '')}`, window.location.origin);
};

const compile = (path: string): RegExp => new RegExp(`^${path.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`);

const pending = <T>() => new Promise<T>(() => undefined);

const LATENCY_MS = Number(new URLSearchParams(window.location.search).get('latency') ?? 0);

// The screen's app talks to these answers instead of a server: everything it asks for over
// HTTP goes through `http`, models included, so nothing leaves the page. What is not here
// stays pending, as on a slow network, and the panel that asked keeps its loading state.
export const serveScreen = (routes: ScreenRoute[]): void => {
    const table = routes.map(([method, path, answer]) => ({ method, pattern: compile(path), answer }));

    http.request = async <T>(request: HttpRequest): Promise<T> => {
        const url = toApiUrl(request.url);
        const path = url.pathname.startsWith(`${API_PATH}/`) ? url.pathname.slice(API_PATH.length) : url.pathname;

        for (const route of table) {
            const match = route.method === request.method ? route.pattern.exec(path) : null;
            const answer = match
                ? await route.answer({ params: match.groups ?? {}, query: toQuery(url, request.query), body: request.body })
                : undefined;
            if (answer !== undefined) {
                await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
                return structuredClone(answer) as T;
            }
        }

        if (import.meta.env.DEV) {
            console.debug('[landing screen] unanswered', request.method, path + url.search, request.query ?? '');
        }
        return pending<T>();
    };
};
