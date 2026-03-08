import { HttpClient } from './HttpClient';
import type { HttpMethod, HttpQuery, HttpRequest } from './HttpClient';
import type { PaginatedResponse, PaginationMeta } from '@/shared/domain/pagination';

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

let globalGetTeamId: (() => string | null) | undefined;

export const setGetTeamId = (fn: () => string | null) => {
    globalGetTeamId = fn;
};

export default class VoltClient{
    private readonly inFlight = new Map<string, Promise<unknown>>();

    constructor(
        private readonly http: HttpClient,
        private readonly basePath: string,
        private readonly opts: VoltClientOptions = {}
    ){}

    private normalizePath(path: string){
        if(path.startsWith('/')){
            return path;
        }

        return `/${path || ""}`;
    }

    private buildUrl(path: string){
        const base = this.normalizePath(this.basePath);
        const sub = path === '/' ? '' : this.normalizePath(path);

        if(!this.opts.useRBAC) return `${base}${sub}`;

        // Get team id for role-based access 
        const teamId = this.opts.getTeamId?.() ?? globalGetTeamId?.();
        if(!teamId) throw new Error('VoltClient: missing teamId for RBAC');

        // Server routes that uses RBAC follows this rule:
        // /api/{module-name}/:teamId/.../
        return `${base}/${teamId}${sub}`;
    }

    private buildCacheKey(path: string, query?: HttpQuery): string{
        const url = this.buildUrl(path);
        const queryStr = query ? JSON.stringify(query) : '';
        return `${url}:${queryStr}`;
    }

    request<T>(method: HttpMethod, path: string, args?: RequestArgs): Promise<T>;
    request(method: HttpMethod, path: string, args?: RequestArgs): Promise<unknown>{
        return this.http.request<unknown>({
            method,
            url: this.buildUrl(path),
            ...args
        });
    }

    async get<T>(path: string, query?: HttpQuery): Promise<T>;
    async get(path: string, query?: HttpQuery): Promise<unknown>{
        const key = this.buildCacheKey(path, query);

        const existing = this.inFlight.get(key);
        if(existing) return existing;

        const promise = this.request('GET', path, { query });
        this.inFlight.set(key, promise);

        try{
            return await promise;
        }finally{
            this.inFlight.delete(key);
        }
    }

    post<T>(path: string, body?: unknown): Promise<T>;
    post(path: string, body?: unknown): Promise<unknown>{
        return this.request('POST', path, { body });
    }

    patch<T>(path: string, body?: unknown): Promise<T>;
    patch(path: string, body?: unknown): Promise<unknown>{
        return this.request('PATCH', path, { body });
    }

    delete<T>(path: string, query?: HttpQuery): Promise<T>;
    delete(path: string, query?: HttpQuery): Promise<unknown>{
        return this.request('DELETE', path, { query });
    }

    /**
     * GET + unwrap { status, data } envelope
     */
    async getUnwrapped<T>(path: string, query?: HttpQuery): Promise<T> {
        const response = await this.get<ResponseEnvelope<T>>(path, query);
        return response.data;
    }

    /**
     * GET + unwrap a specific field from { status, data: { [field]: value } }
     */
    async getField<T extends object, K extends keyof T>(path: string, field: K, query?: HttpQuery): Promise<T[K]> {
        const response = await this.get<ResponseEnvelope<T>>(path, query);
        return response.data[field];
    }

    /**
     * POST + unwrap { status, data } envelope
     */
    async postUnwrapped<T>(path: string, body?: unknown): Promise<T> {
        const response = await this.post<ResponseEnvelope<T>>(path, body);
        return response.data;
    }

    /**
     * POST + unwrap a specific field
     */
    async postField<T extends object, K extends keyof T>(path: string, field: K, body?: unknown): Promise<T[K]> {
        const response = await this.post<ResponseEnvelope<T>>(path, body);
        return response.data[field];
    }

    /**
     * PATCH + unwrap { status, data } envelope
     */
    async patchUnwrapped<T>(path: string, body?: unknown): Promise<T> {
        const response = await this.patch<ResponseEnvelope<T>>(path, body);
        return response.data;
    }

    /**
     * PATCH + unwrap a specific field
     */
    async patchField<T extends object, K extends keyof T>(path: string, field: K, body?: unknown): Promise<T[K]> {
        const response = await this.patch<ResponseEnvelope<T>>(path, body);
        return response.data[field];
    }

    /**
     * DELETE + unwrap { status, data } envelope
     */
    async deleteUnwrapped<T>(path: string, query?: HttpQuery): Promise<T> {
        const response = await this.delete<ResponseEnvelope<T>>(path, query);
        return response.data;
    }

    /**
     * GET paginated response, transforming raw server format to PaginatedResponse<T>
     */
    async getPaginated<T>(path: string, params?: HttpQuery): Promise<PaginatedResponse<T>> {
        const raw = await this.get<RawPaginatedResponse<T>>(path, params);
        return unwrapPaginated(raw);
    }

    /**
     * GET that returns a Blob (for file exports)
     */
    exportFile(path: string, params?: HttpQuery): Promise<Blob> {
        return this.request<Blob>('GET', path, {
            query: params,
            responseType: 'blob'
        });
    }
};
