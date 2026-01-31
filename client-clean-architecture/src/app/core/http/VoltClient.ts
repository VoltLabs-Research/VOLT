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
};

export default class VoltClient{
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
        const teamId = this.opts.getTeamId?.();
        if(!teamId) throw new Error('VoltClient: missing teamId for RBAC');

        // Server routes that uses RBAC follows this rule:
        // /api/{module-name}/:teamId/.../
        return `${base}/${teamId}${sub}`;
    }

    request<T>(method: HttpMethod, path: string, args?: RequestArgs): Promise<T>{
        return this.http.request<T>({
            method,
            url: this.buildUrl(path),
            ...args
        });
    }

    get<T>(path: string, query?: Record<string, any>){
        return this.request<T>('GET', path, { query });
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