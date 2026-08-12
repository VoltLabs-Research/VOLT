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
    useRBAC?: boolean;
    getTeamId?: () => string | null;
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

        return `${base}/${teamId}${sub}`;
    }

    private buildCacheKey(path: string, query?: HttpQuery): string {
        const url = this.buildUrl(path);
        const queryStr = query ? JSON.stringify(query, Object.keys(query).sort()) : '';
        return `${url}:${queryStr}`;
    }

    withTeam(teamId: string): VoltClient {
        return new VoltClient(this.http, this.basePath, {
            ...this.opts,
            useRBAC: true,
            getTeamId: () => teamId
        });
    }

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

    async getUnwrapped<T>(path: string, query?: HttpQuery): Promise<T> {
        const response = await this.get<ResponseEnvelope<T>>(path, query);
        return response.data;
    }

    async postUnwrapped<T>(path: string, body?: unknown): Promise<T> {
        const response = await this.post<ResponseEnvelope<T>>(path, body);
        return response.data;
    }

    async patchUnwrapped<T>(path: string, body?: unknown): Promise<T> {
        const response = await this.patch<ResponseEnvelope<T>>(path, body);
        return response.data;
    }

    async deleteUnwrapped<T>(path: string, query?: HttpQuery): Promise<T> {
        const response = await this.delete<ResponseEnvelope<T>>(path, query);
        return response.data;
    }

    async getPaginated<T>(path: string, params?: HttpQuery): Promise<PaginatedResponse<T>> {
        const raw = await this.get<RawPaginatedResponse<T>>(path, params);
        return unwrapPaginated(raw);
    }

    exportFile(path: string, params?: HttpQuery): Promise<Blob> {
        return this.request<Blob>('GET', path, {
            query: params,
            responseType: 'blob'
        });
    }
};
