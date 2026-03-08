import { HttpClient, HttpMethod } from './HttpClient';
import type { PaginatedResponse, PaginationMeta } from '@/shared/domain/pagination';

interface RawPaginatedResponse<T> {
    status: 'success';
    data: T[] | {
        data: T[];
        total: number;
        page: number;
        totalPages: number;
        limit: number;
    };
    pagination?: PaginationMeta;
    _meta?: Record<string, unknown>;
}

function unwrapPaginated<T>(raw: RawPaginatedResponse<T>): PaginatedResponse<T> {
    if (Array.isArray(raw.data) && raw.pagination) {
        return {
            status: 'success',
            data: raw.data,
            pagination: raw.pagination,
            _meta: raw._meta
        };
    }

    const inner = raw.data as {
        data: T[];
        total: number;
        page: number;
        totalPages: number;
        limit: number;
    };

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

export type VoltClientOptions = {
    useRBAC?: boolean;
    getTeamId?: () => string | null;
};

export interface RequestArgs{
    query?: Record<string, any>;
    body?: any;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    responseType?: 'json' | 'blob' | 'text';
    onUploadProgress?: (event: { loaded: number; total?: number }) => void;
};

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

    private buildCacheKey(path: string, query?: Record<string, any>): string{
        const url = this.buildUrl(path);
        const queryStr = query ? JSON.stringify(query) : '';
        return `${url}:${queryStr}`;
    }

    request<T>(method: HttpMethod, path: string, args?: RequestArgs): Promise<T>{
        return this.http.request<T>({
            method,
            url: this.buildUrl(path),
            ...args
        });
    }

    async get<T>(path: string, query?: Record<string, any>): Promise<T>{
        const key = this.buildCacheKey(path, query);

        const existing = this.inFlight.get(key);
        if(existing) return existing as Promise<T>;

        const promise = this.request<T>('GET', path, { query });
        this.inFlight.set(key, promise);

        try{
            return await promise;
        }finally{
            this.inFlight.delete(key);
        }
    }

    post<T>(path: string, body?: any){
        return this.request<T>('POST', path, { body });
    }

    patch<T>(path: string, body?: any){
        return this.request<T>('PATCH', path, { body });
    }

    delete<T>(path: string, query?: Record<string, any>){
        return this.request<T>('DELETE', path, { query });
    }

    /**
     * GET + unwrap { status, data } envelope
     */
    async getUnwrapped<T>(path: string, query?: Record<string, any>): Promise<T> {
        const response = await this.get<{ status: string; data: T }>(path, query);
        return response.data;
    }

    /**
     * GET + unwrap a specific field from { status, data: { [field]: value } }
     */
    async getField<T extends object, K extends keyof T>(path: string, field: K, query?: Record<string, any>): Promise<T[K]> {
        const response = await this.get<{ status: string; data: T }>(path, query);
        return response.data[field];
    }

    /**
     * POST + unwrap { status, data } envelope
     */
    async postUnwrapped<T>(path: string, body?: any): Promise<T> {
        const response = await this.post<{ status: string; data: T }>(path, body);
        return response.data;
    }

    /**
     * POST + unwrap a specific field
     */
    async postField<T extends object, K extends keyof T>(path: string, field: K, body?: any): Promise<T[K]> {
        const response = await this.post<{ status: string; data: T }>(path, body);
        return response.data[field];
    }

    /**
     * PATCH + unwrap { status, data } envelope
     */
    async patchUnwrapped<T>(path: string, body?: any): Promise<T> {
        const response = await this.patch<{ status: string; data: T }>(path, body);
        return response.data;
    }

    /**
     * PATCH + unwrap a specific field
     */
    async patchField<T extends object, K extends keyof T>(path: string, field: K, body?: any): Promise<T[K]> {
        const response = await this.patch<{ status: string; data: T }>(path, body);
        return response.data[field];
    }

    /**
     * DELETE + unwrap { status, data } envelope
     */
    async deleteUnwrapped<T>(path: string, query?: Record<string, any>): Promise<T> {
        const response = await this.delete<{ status: string; data: T }>(path, query);
        return response.data;
    }

    /**
     * GET paginated response, transforming raw server format to PaginatedResponse<T>
     */
    async getPaginated<T>(path: string, params?: object): Promise<PaginatedResponse<T>> {
        const raw = await this.get<RawPaginatedResponse<T>>(path, params as Record<string, unknown> | undefined);
        return unwrapPaginated(raw);
    }

    /**
     * GET that returns a Blob (for file exports)
     */
    exportFile<P extends object = Record<string, unknown>>(path: string, params?: P): Promise<Blob> {
        return this.request<Blob>('GET', path, {
            query: params as Record<string, unknown> | undefined,
            responseType: 'blob'
        });
    }
};
