/**
 * Service factory with automatic path/body/query splitting.
 *
 * Convention:
 *  - Every method receives a FLAT params object.
 *  - Path params (`:key` in the template) are auto-extracted.
 *  - Remaining params go to body (POST/PATCH) or query (GET/DELETE) automatically.
 *  - Defaults: unwrap 'data' for get/post/patch, 'void' for del, 'paginated' for paginated.
 *  - Override body/query/unwrap via opts when the default doesn't fit.
 */
import { createApiClient } from '@/app/core/http/utilities/create-client';
import type { HttpMethod } from '@/app/core/http/client/HttpClient';
import type VoltClient from '@/app/core/http/client/VoltClient';
import type { RequestArgs } from '@/app/core/http/client/VoltClient';

// ─── Types ───────────────────────────────────────────────────────────────────

type UnknownRecord = Record<string, unknown>;
type ResponseType = NonNullable<RequestArgs['responseType']>;
type ProgressEvent = { loaded: number; total?: number };
type PathLike<P> = string | ((params: P) => string);

export type EmptyParams = Record<string, never>;
export type UnwrapMode = 'data' | 'raw' | 'void' | 'paginated' | { field: string };

// ─── Client Config ───────────────────────────────────────────────────────────

export interface ClientDescriptor<P = unknown> {
    basePath: string;
    useRBAC?: boolean;
    getTeamId?: (params: P) => string | null | undefined;
}

export interface ServiceExecutionContext {
    clients: Record<string, VoltClient>;
    getClient: (name?: string) => VoltClient;
}

// ─── Method Options (escape hatches for non-standard cases) ──────────────────

export interface MethodOpts<P, R> {
    client?: string;
    unwrap?: UnwrapMode;
    omit?: readonly (keyof P)[];
    body?: (params: P) => unknown;
    query?: (params: P) => object | undefined;
    headers?: Record<string, string> | ((params: P) => Record<string, string> | undefined);
    responseType?: ResponseType;
    onUploadProgress?: (params: P) => ((event: ProgressEvent) => void) | undefined;
    map?: (result: unknown, params: P) => R;
    validate?: (params: P) => void;
}

// ─── Internal Descriptor ─────────────────────────────────────────────────────

type Op = 'get' | 'post' | 'patch' | 'delete' | 'getPaginated' | 'request';

interface Descriptor<P = any, R = any> {
    kind: 'standard' | 'custom';
    op?: Op;
    httpMethod?: HttpMethod;
    path?: PathLike<P>;
    opts?: MethodOpts<P, R>;
    run?: (ctx: ServiceExecutionContext, params: P) => Promise<R> | R;
}

type Methods = Record<string, Descriptor>;

export type BuiltService<T extends Methods> = {
    [K in keyof T]: T[K] extends Descriptor<infer P, infer R>
        ? (params: P) => Promise<R>
        : never;
};

// ─── Service Config ──────────────────────────────────────────────────────────

type ServiceConfig =
    | string
    | { basePath: string; useRBAC?: boolean }
    | { clients: Record<string, ClientDescriptor<any>> };

// ─── Utilities ───────────────────────────────────────────────────────────────

const buildPath = (template: string, params: UnknownRecord): string =>
    template.replace(/:(\w+)/g, (_, key) => {
        const val = params[key];
        if (val == null) throw new Error(`Missing path param: ${key}`);
        return String(val);
    });

const pathParamNames = (template: string): Set<string> => {
    const names = new Set<string>();
    for (const [, name] of template.matchAll(/:(\w+)/g)) names.add(name);
    return names;
};

const stripKeys = (obj: UnknownRecord, keys: Iterable<string | number | symbol>): UnknownRecord => {
    const exclude = new Set<string | number | symbol>(keys);
    const out: UnknownRecord = {};
    for (const [k, v] of Object.entries(obj)) {
        if (!exclude.has(k) && v !== undefined) out[k] = v;
    }
    return out;
};

const unwrapResponse = (raw: unknown, mode: UnwrapMode): unknown => {
    if (mode === 'raw' || mode === 'paginated') return raw;
    if (mode === 'void') return undefined;
    const res = raw as { data?: unknown };
    if (mode === 'data') return res.data;
    return (res.data as UnknownRecord)?.[mode.field];
};

const DEFAULT_UNWRAP: Record<Op, UnwrapMode> = {
    get: 'data',
    post: 'data',
    patch: 'data',
    delete: 'void',
    getPaginated: 'paginated',
    request: 'data',
};

const OP_TO_HTTP: Record<string, HttpMethod> = {
    get: 'GET',
    post: 'POST',
    patch: 'PATCH',
    delete: 'DELETE',
};

// ─── Client Resolution ───────────────────────────────────────────────────────

const normalizeConfig = (cfg: ServiceConfig): Record<string, ClientDescriptor<any>> => {
    if (typeof cfg === 'string') return { default: { basePath: cfg } };
    if ('clients' in cfg) return cfg.clients;
    return { default: cfg };
};

const firstClientName = (clients: Record<string, ClientDescriptor<any>>): string => {
    if ('default' in clients) return 'default';
    const name = Object.keys(clients)[0];
    if (!name) throw new Error('createService: at least one client is required');
    return name;
};

// ─── Core Execution ──────────────────────────────────────────────────────────

const execute = async <P, R>(client: VoltClient, desc: Descriptor<P, R>, params: P): Promise<R> => {
    const opts = desc.opts ?? {};
    const op = desc.op!;
    const raw = (params ?? {}) as UnknownRecord;

    opts.validate?.(params);

    // Resolve path
    const pathDef = desc.path ?? '/';
    const isTemplate = typeof pathDef === 'string';
    const path = isTemplate ? buildPath(pathDef, raw) : pathDef(params);

    // Auto-split remaining params
    const extracted = isTemplate ? pathParamNames(pathDef) : new Set<string>();
    let remaining = stripKeys(raw, extracted);
    if (opts.omit) remaining = stripKeys(remaining, opts.omit);
    const hasRemaining = Object.keys(remaining).length > 0;

    // Resolve request parts
    const isBodyOp = op === 'post' || op === 'patch';
    const body = opts.body ? opts.body(params) : (isBodyOp && hasRemaining ? remaining : undefined);
    const query = opts.query
        ? (opts.query(params) as UnknownRecord | undefined)
        : (!isBodyOp && hasRemaining ? remaining : undefined);
    const headers = typeof opts.headers === 'function' ? opts.headers(params) : opts.headers;
    const uploadProgress = opts.onUploadProgress?.(params);
    const resType = opts.responseType;

    // Dispatch
    let result: unknown;
    const needsRaw = !!(headers || resType || uploadProgress) || (op === 'delete' && body != null);

    if (op === 'getPaginated') {
        result = await client.getPaginated(path, query);
    } else if (op === 'request') {
        result = await client.request(desc.httpMethod!, path, {
            query, body, headers, responseType: resType, onUploadProgress: uploadProgress,
        });
    } else if (needsRaw) {
        result = await client.request(OP_TO_HTTP[op], path, {
            query, body, headers, responseType: resType, onUploadProgress: uploadProgress,
        });
    } else {
        switch (op) {
            case 'get': result = await client.get(path, query); break;
            case 'post': result = await client.post(path, body); break;
            case 'patch': result = await client.patch(path, body); break;
            case 'delete': result = await client.delete(path, query); break;
        }
    }

    // Unwrap + map
    const unwrap = opts.unwrap ?? DEFAULT_UNWRAP[op];
    const unwrapped = unwrapResponse(result, unwrap);
    return opts.map ? opts.map(unwrapped, params) : unwrapped as R;
};

// ─── createService ───────────────────────────────────────────────────────────

export const createService = <T extends Methods>(config: ServiceConfig, methods: T): BuiltService<T> => {
    const clientDescs = normalizeConfig(config);
    const defName = firstClientName(clientDescs);
    const cache = new Map<string, VoltClient>();

    const resolve = (name: string, params: unknown): VoltClient => {
        const desc = clientDescs[name];
        if (!desc) throw new Error(`createService: unknown client '${name}'`);

        if (desc.getTeamId) {
            return createApiClient(desc.basePath, {
                useRBAC: desc.useRBAC,
                getTeamId: () => desc.getTeamId?.(params) ?? null,
            });
        }

        let client = cache.get(name);
        if (!client) {
            client = createApiClient(desc.basePath, { useRBAC: desc.useRBAC });
            cache.set(name, client);
        }
        return client;
    };

    const svc = {} as BuiltService<T>;

    for (const [name, desc] of Object.entries(methods)) {
        (svc as any)[name] = async (params: any) => {
            const clientName = desc.opts?.client ?? defName;

            if (desc.kind === 'custom') {
                desc.opts?.validate?.(params);
                const clients = Object.fromEntries(
                    Object.keys(clientDescs).map((n) => [n, resolve(n, params)])
                );
                return desc.run!(
                    { clients, getClient: (n?: string) => resolve(n ?? clientName, params) },
                    params
                );
            }

            return execute(resolve(clientName, params), desc, params);
        };
    }

    return svc;
};

// ─── Method Helpers ──────────────────────────────────────────────────────────

export const get = <P, R>(path: PathLike<P>, opts?: MethodOpts<P, R>): Descriptor<P, R> =>
    ({ kind: 'standard', op: 'get', path, opts });

export const post = <P, R>(path: PathLike<P>, opts?: MethodOpts<P, R>): Descriptor<P, R> =>
    ({ kind: 'standard', op: 'post', path, opts });

export const patch = <P, R>(path: PathLike<P>, opts?: MethodOpts<P, R>): Descriptor<P, R> =>
    ({ kind: 'standard', op: 'patch', path, opts });

export const del = <P, R = void>(path: PathLike<P>, opts?: MethodOpts<P, R>): Descriptor<P, R> =>
    ({ kind: 'standard', op: 'delete', path, opts });

export const paginated = <P, R>(path: PathLike<P>, opts?: MethodOpts<P, R>): Descriptor<P, R> =>
    ({ kind: 'standard', op: 'getPaginated', path, opts });

export const request = <P, R>(method: HttpMethod, path: PathLike<P>, opts?: MethodOpts<P, R>): Descriptor<P, R> =>
    ({ kind: 'standard', op: 'request', httpMethod: method, path, opts });

export const download = <P>(
    method: HttpMethod,
    path: PathLike<P>,
    opts?: Omit<MethodOpts<P, Blob>, 'unwrap' | 'responseType'>
): Descriptor<P, Blob> =>
    ({
        kind: 'standard',
        op: 'request',
        httpMethod: method,
        path,
        opts: { ...opts, responseType: 'blob', unwrap: 'raw' } as MethodOpts<P, Blob>,
    });

export const custom = <P, R>(
    run: (ctx: ServiceExecutionContext, params: P) => Promise<R> | R,
    opts?: Pick<MethodOpts<P, R>, 'validate'>
): Descriptor<P, R> =>
    ({ kind: 'custom', run, opts });
