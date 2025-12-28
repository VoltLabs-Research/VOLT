import type { HttpMethod, RetryConfig, RequestArgs } from '@/api/api-core';
import { objectToSearchParams, appendSearchParams } from '@/utilities/query';
import APICore from '@/api/api-core';

type WithQuery<M extends HttpMethod> = RequestArgs<M> & {
    query?: Record<string, any>;
};

export interface VoltClientOptions {
    useRBAC?: boolean;
    getTeamId?: () => string | null;
    retry?: Partial<RetryConfig>;
};

const normalizePath = (path: string) => {
    if (!path) return '';
    return path.startsWith('/') ? path : `/${path}`;
};

const joinUrl = (a: string, b: string) => {
    const left = a.endsWith('/') ? a.slice(0, -1) : a;
    const right = b.startsWith('/') ? b : `/${b}`;
    return `${left}${right}`;
};

export const withApiUrl = (path: string) => {
    return import.meta.env.VITE_API_URL + '/api' + path;
};

let globalGetTeamId: (() => string | null) | undefined;

export const setGetTeamId = (fn: () => string | null) => {
    globalGetTeamId = fn;
};

export default class VoltClient {
    private readonly basePath: string;
    private readonly useRBAC: boolean;
    private readonly getTeamId?: () => string | null;
    private readonly defaultRetry?: Partial<RetryConfig>;
    private readonly core: APICore;

    constructor(
        basePath: string,
        opts: VoltClientOptions = {}
    ) {
        this.basePath = normalizePath(basePath);
        this.core = new APICore({ baseURL: withApiUrl('') });
        this.useRBAC = opts.useRBAC ?? false;
        this.getTeamId = opts.getTeamId;
        this.defaultRetry = opts.retry;
    }

    private buildUrl(path: string) {
        const raw = path ?? '';
        const npath = raw === '/' ? '' : normalizePath(raw);

        if (!this.useRBAC) {
            return this.basePath + npath;
        }

        const teamId = (this.getTeamId ? this.getTeamId() : globalGetTeamId?.()) ?? null;
        if (!teamId) throw new Error('VoltClient: Missing teamId (useRBAC=true)');

        return `${this.basePath}/${teamId}${npath}`;
    }

    request<T = any, M extends HttpMethod = HttpMethod>(
        method: M,
        path: string,
        args: WithQuery<M> = {} as WithQuery<M>
    ) {
        let url = this.buildUrl(path);
        if (args.query) {
            url = appendSearchParams(url, objectToSearchParams(args.query));
        }

        const mergedRetry = { ...(this.defaultRetry ?? {}), ...(args.retry ?? {}) };

        if (method === 'get' || method === 'delete') {
            return this.core.request<T, M>(method, url, {
                config: args.config,
                dedupe: args.dedupe,
                retry: mergedRetry
            } as any);
        }

        return this.core.request<T, M>(method, url, {
            config: args.config,
            data: args.data,
            retry: mergedRetry
        });
    };

    scope(subPath: string) {
        return new VoltClient(joinUrl(this.basePath, normalizePath(subPath)), {
            useRBAC: this.useRBAC,
            getTeamId: this.getTeamId,
            retry: this.defaultRetry
        });
    }
}