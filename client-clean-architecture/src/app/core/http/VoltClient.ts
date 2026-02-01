import { HttpClient, HttpMethod } from './HttpClient';

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
};
