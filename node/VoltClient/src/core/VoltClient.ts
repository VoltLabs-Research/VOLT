import type { HttpClient, HttpMethod, HttpQuery, HttpRequest } from './HttpClient';
import type { PaginatedResponse, PaginationMeta } from '../pagination/PaginationResponse';

interface RawPaginatedPage<T> {
    data: T[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
};

interface RawPaginatedResponse<T> {
    status: 'success';
    data: T[] | RawPaginatedPage<T>;
    pagination?: PaginationMeta;
    _meta?: Record<string, unknown>;
};

interface ResponseEnvelope<T> {
    status: string;
    data: T;
};

export interface VoltClientOptions {
    /** Inject /:teamId into every URL for RBAC-protected routes. */
    useRBAC?: boolean;
    /** Provides the current team ID. Required when `useRBAC` is true. */
    getTeamId?: () => string | null;
    /**
     * Coalesce concurrent identical GET requests into a single in-flight promise.
     * Useful in UI contexts that fire the same fetch from multiple components.
     * Defaults to `true`; set to `false` for server-side callers that want each
     * `get()` to map 1:1 to a network request.
     */
    dedupeGetRequests?: boolean;
};

export type RequestArgs = Omit<HttpRequest, 'method' | 'url'>;

function unwrapPaginated<T>(raw: RawPaginatedResponse<T>): PaginatedResponse<T> {
    if (Array.isArray(raw.data)) {
        if (!raw.pagination) {
            throw new Error('VoltClient: paginated response missing pagination metadata');
        }

        return {
            status: 'success',
            data: raw.data,
            pagination: raw.pagination,
            _meta: raw._meta
        };
    }

    const inner = raw.data;

    const pagination: PaginationMeta = {
        page: inner.page,
        limit: inner.limit,
        total: inner.total,
        totalPages: inner.totalPages,
        hasMore: inner.page < inner.totalPages
    };

    return {
        status: 'success',
        data: inner.data,
        pagination
    };
}

/**
 * HTTP client scoped to a base path, with:
 * - Optional RBAC `/:teamId` injection
 * - In-flight GET deduplication (opt out via `dedupeGetRequests: false`)
 * - Typed envelope unwrappers (`getUnwrapped`, `postUnwrapped`, …)
 * - Paginated response normalization (`getPaginated`)
 *
 * Choosing a layer:
 * - Use {@link request}/{@link get}/{@link post} for raw responses you unwrap yourself.
 * - Use the `*Unwrapped` helpers when the server wraps payloads in `{ status, data }`.
 * - For a declarative, typed surface across many endpoints, prefer building a
 *   service with `createService` rather than calling these methods directly.
 */
export default class VoltClient {
    private readonly inFlight = new Map<string, Promise<unknown>>();

    constructor(
        private readonly http: HttpClient,
        private readonly basePath: string,
        private readonly opts: VoltClientOptions = {}
    ) {}

    private normalizePath(path: string): string {
        if (path.startsWith('/')) return path;
        return `/${path || ''}`;
    }

    private buildUrl(path: string): string {
        const base = this.normalizePath(this.basePath);
        const sub = path === '/' ? '' : this.normalizePath(path);

        if (!this.opts.useRBAC) return `${base}${sub}`;

        const teamId = this.opts.getTeamId?.();
        if (!teamId) throw new Error('VoltClient: missing teamId for RBAC');

        // Server routes that use RBAC follow: /api/{module-name}/:teamId/.../
        return `${base}/${teamId}${sub}`;
    }

    private buildCacheKey(path: string, query?: HttpQuery): string {
        const url = this.buildUrl(path);
        // Sort keys so that {a,b} and {b,a} dedupe to the same in-flight request.
        const queryStr = query ? JSON.stringify(query, Object.keys(query).sort()) : '';
        return `${url}:${queryStr}`;
    }

    /**
     * Returns a new `VoltClient` instance scoped to the given `teamId`,
     * reusing the same underlying `HttpClient` and base path.
     */
    withTeam(teamId: string): VoltClient {
        return new VoltClient(this.http, this.basePath, {
            ...this.opts,
            useRBAC: true,
            getTeamId: () => teamId
        });
    }

    /**
     * Returns a new `VoltClient` scoped to a sub-path, reusing this instance's
     * HTTP adapter and options. Useful for creating per-resource clients without
     * re-instantiating the HTTP layer.
     */
    withBasePath(basePath: string, opts?: VoltClientOptions): VoltClient {
        return new VoltClient(this.http, basePath, opts ?? this.opts);
    }

    request<T>(method: HttpMethod, path: string, args?: RequestArgs): Promise<T>;
    request(method: HttpMethod, path: string, args?: RequestArgs): Promise<unknown> {
        return this.http.request<unknown>({
            method,
            url: this.buildUrl(path),
            ...args
        });
    }

    async get<T>(path: string, query?: HttpQuery): Promise<T>;
    async get(path: string, query?: HttpQuery): Promise<unknown> {
        if (this.opts.dedupeGetRequests === false) {
            return this.request('GET', path, { query });
        }

        const key = this.buildCacheKey(path, query);

        const existing = this.inFlight.get(key);
        if (existing) return existing;

        const promise = this.request('GET', path, { query });
        this.inFlight.set(key, promise);

        try {
            return await promise;
        } finally {
            this.inFlight.delete(key);
        }
    }

    post<T>(path: string, body?: unknown): Promise<T>;
    post(path: string, body?: unknown): Promise<unknown> {
        return this.request('POST', path, { body });
    }

    patch<T>(path: string, body?: unknown): Promise<T>;
    patch(path: string, body?: unknown): Promise<unknown> {
        return this.request('PATCH', path, { body });
    }

    delete<T>(path: string, query?: HttpQuery): Promise<T>;
    delete(path: string, query?: HttpQuery): Promise<unknown> {
        return this.request('DELETE', path, { query });
    }

    /** GET + unwrap `{ status, data }` envelope. */
    async getUnwrapped<T>(path: string, query?: HttpQuery): Promise<T> {
        const response = await this.get<ResponseEnvelope<T>>(path, query);
        return response.data;
    }

    /**
     * GET + unwrap a specific field from `{ status, data: { [field]: value } }`.
     * @deprecated Prefer `(await getUnwrapped<T>(path, query))[field]`; the
     * dedicated field accessors duplicate `*Unwrapped` and will be removed.
     */
    async getField<T extends object, K extends keyof T>(
        path: string,
        field: K,
        query?: HttpQuery
    ): Promise<T[K]> {
        const response = await this.get<ResponseEnvelope<T>>(path, query);
        return response.data[field];
    }

    /** POST + unwrap `{ status, data }` envelope. */
    async postUnwrapped<T>(path: string, body?: unknown): Promise<T> {
        const response = await this.post<ResponseEnvelope<T>>(path, body);
        return response.data;
    }

    /**
     * POST + unwrap a specific field.
     * @deprecated Prefer `(await postUnwrapped<T>(path, body))[field]`.
     */
    async postField<T extends object, K extends keyof T>(
        path: string,
        field: K,
        body?: unknown
    ): Promise<T[K]> {
        const response = await this.post<ResponseEnvelope<T>>(path, body);
        return response.data[field];
    }

    /** PATCH + unwrap `{ status, data }` envelope. */
    async patchUnwrapped<T>(path: string, body?: unknown): Promise<T> {
        const response = await this.patch<ResponseEnvelope<T>>(path, body);
        return response.data;
    }

    /**
     * PATCH + unwrap a specific field.
     * @deprecated Prefer `(await patchUnwrapped<T>(path, body))[field]`.
     */
    async patchField<T extends object, K extends keyof T>(
        path: string,
        field: K,
        body?: unknown
    ): Promise<T[K]> {
        const response = await this.patch<ResponseEnvelope<T>>(path, body);
        return response.data[field];
    }

    /** DELETE + unwrap `{ status, data }` envelope. */
    async deleteUnwrapped<T>(path: string, query?: HttpQuery): Promise<T> {
        const response = await this.delete<ResponseEnvelope<T>>(path, query);
        return response.data;
    }

    /**
     * GET paginated response, normalizing the raw server shape into `PaginatedResponse<T>`.
     * Supports both the flat (`{ data[], pagination }`) and the inline (`{ data: { data[], total, ... } }`) formats.
     */
    async getPaginated<T>(path: string, params?: HttpQuery): Promise<PaginatedResponse<T>> {
        const raw = await this.get<RawPaginatedResponse<T>>(path, params);
        return unwrapPaginated(raw);
    }

    /**
     * GET a file as a `Blob` (suitable for downloads).
     * The caller is responsible for triggering the browser download if needed.
     */
    exportFile(path: string, params?: HttpQuery): Promise<Blob> {
        return this.request<Blob>('GET', path, {
            query: params,
            responseType: 'blob'
        });
    }
};
