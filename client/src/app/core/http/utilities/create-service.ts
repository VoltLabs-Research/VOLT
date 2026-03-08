import { createApiClient } from '@/app/core/http/utilities/create-client';
import type { HttpMethod, HttpProgressEvent } from '@/app/core/http/client/HttpClient';
import type VoltClient from '@/app/core/http/client/VoltClient';
import type { RequestArgs } from '@/app/core/http/client/VoltClient';

type UnknownRecord = Record<string, unknown>;
type ResponseType = NonNullable<RequestArgs['responseType']>;
type Op = 'get' | 'post' | 'patch' | 'delete' | 'getPaginated' | 'request';
type BivariantCallback<TArgs extends unknown[], TResult> = {
    bivarianceHack(...args: TArgs): TResult;
}['bivarianceHack'];
type PathLike<P> = string | BivariantCallback<[params: P], string>;

export type EmptyParams = Record<string, never>;
export type UnwrapMode = 'data' | 'raw' | 'void' | 'paginated' | { field: string };

export interface ClientDescriptor<P = unknown> {
    basePath: string;
    useRBAC?: boolean;
    getTeamId?(params: P): string | null | undefined;
};

export interface ServiceExecutionContext {
    clients: Record<string, VoltClient>;
    getClient(name?: string): VoltClient;
};

export interface MethodOpts<P, R, TRaw = unknown> {
    client?: string;
    unwrap?: UnwrapMode;
    omit?: readonly (keyof P)[];
    body?: BivariantCallback<[params: P], unknown>;
    query?: BivariantCallback<[params: P], UnknownRecord | undefined>;
    headers?: Record<string, string> | BivariantCallback<[params: P], Record<string, string> | undefined>;
    responseType?: ResponseType;
    onUploadProgress?: BivariantCallback<[params: P], ((event: HttpProgressEvent) => void) | undefined>;
    map?: BivariantCallback<[result: TRaw, params: P], R>;
    validate?: BivariantCallback<[params: P], void>;
};

interface Descriptor<P = unknown, R = unknown, TRaw = unknown> {
    kind: 'standard' | 'custom';
    op?: Op;
    httpMethod?: HttpMethod;
    path?: PathLike<P>;
    opts?: MethodOpts<P, R, TRaw>;
    run?: BivariantCallback<[ctx: ServiceExecutionContext, params: P], Promise<R> | R>;
};

type AnyDescriptor = Descriptor<unknown, unknown, unknown>;

interface SingleClientConfig {
    basePath: string;
    useRBAC?: boolean;
};

interface MultiClientConfig {
    clients: Record<string, ClientDescriptor>;
};

interface ResponseEnvelope {
    data?: unknown;
};

export type BuiltService<T extends Record<string, unknown>> = {
    [K in keyof T]: T[K] extends Descriptor<infer P, infer R, unknown>
        ? (params: P) => Promise<R>
        : never;
};

type ServiceConfig = string | SingleClientConfig | MultiClientConfig;

const isUnknownRecord = (value: unknown): value is UnknownRecord => {
    return typeof value === 'object' && value !== null;
};

const isDescriptor = (value: unknown): value is AnyDescriptor => {
    return isUnknownRecord(value)
        && 'kind' in value
        && (value.kind === 'standard' || value.kind === 'custom');
};

const hasEnvelope = (value: unknown): value is ResponseEnvelope => {
    return isUnknownRecord(value);
};

const toUnknownRecord = (value: unknown): UnknownRecord => {
    if (isUnknownRecord(value)) {
        return value;
    }

    return {};
};

const toTypedResult = <T>(value: unknown): T => value as T;

const createDefaultClients = (basePath: string): Record<string, ClientDescriptor> => {
    return {
        default: {
            basePath
        }
    };
};

const buildPath = (template: string, params: UnknownRecord): string =>
    template.replace(/:(\w+)/g, (_, key) => {
        const value = params[key];
        if (value == null) throw new Error(`Missing path param: ${key}`);
        return String(value);
    });

const pathParamNames = (template: string): Set<string> => {
    const names = new Set<string>();
    for (const [, name] of template.matchAll(/:(\w+)/g)) {
        names.add(name);
    }
    return names;
};

const stripKeys = (obj: UnknownRecord, keys: Iterable<string | number | symbol>): UnknownRecord => {
    const exclude = new Set<string | number | symbol>(keys);
    const output: UnknownRecord = {};

    for (const [key, value] of Object.entries(obj)) {
        if (!exclude.has(key) && value !== undefined) {
            output[key] = value;
        }
    }

    return output;
};

const unwrapResponse = (raw: unknown, mode: UnwrapMode): unknown => {
    if (mode === 'raw' || mode === 'paginated') return raw;
    if (mode === 'void') return undefined;
    if (!hasEnvelope(raw)) return undefined;
    if (mode === 'data') return raw.data;
    if (!isUnknownRecord(raw.data)) return undefined;
    return raw.data[mode.field];
};

const DEFAULT_UNWRAP: Record<Op, UnwrapMode> = {
    get: 'data',
    post: 'data',
    patch: 'data',
    delete: 'void',
    getPaginated: 'paginated',
    request: 'data'
};

const OP_TO_HTTP: Record<string, HttpMethod> = {
    get: 'GET',
    post: 'POST',
    patch: 'PATCH',
    delete: 'DELETE'
};

const firstClientName = (clients: Record<string, ClientDescriptor>): string => {
    if ('default' in clients) return 'default';

    const name = Object.keys(clients)[0];
    if (!name) throw new Error('createService: at least one client is required');

    return name;
};

const execute = async <P, R, TRaw>(client: VoltClient, desc: Descriptor<P, R, TRaw>, params: P): Promise<R> => {
    const opts = desc.opts ?? {};
    const op = desc.op!;
    const raw = toUnknownRecord(params);

    opts.validate?.(params);

    const pathDef = desc.path ?? '/';
    const isTemplate = typeof pathDef === 'string';
    const path = isTemplate ? buildPath(pathDef, raw) : pathDef(params);

    const extracted = isTemplate ? pathParamNames(pathDef) : new Set<string>();
    let remaining = stripKeys(raw, extracted);
    if (opts.omit) {
        remaining = stripKeys(remaining, opts.omit);
    }
    const hasRemaining = Object.keys(remaining).length > 0;

    const isBodyOp = op === 'post' || op === 'patch';
    const body = opts.body ? opts.body(params) : (isBodyOp && hasRemaining ? remaining : undefined);
    const query = opts.query ? opts.query(params) : (!isBodyOp && hasRemaining ? remaining : undefined);
    const headers = typeof opts.headers === 'function' ? opts.headers(params) : opts.headers;
    const uploadProgress = opts.onUploadProgress?.(params);
    const responseType = opts.responseType;

    let result: unknown;
    const needsRaw = Boolean(headers || responseType || uploadProgress) || (op === 'delete' && body != null);

    if (op === 'getPaginated') {
        result = await client.getPaginated(path, query);
    } else if (op === 'request') {
        result = await client.request(desc.httpMethod!, path, {
            query,
            body,
            headers,
            responseType,
            onUploadProgress: uploadProgress
        });
    } else if (needsRaw) {
        result = await client.request(OP_TO_HTTP[op], path, {
            query,
            body,
            headers,
            responseType,
            onUploadProgress: uploadProgress
        });
    } else {
        switch (op) {
            case 'get':
                result = await client.get(path, query);
                break;
            case 'post':
                result = await client.post(path, body);
                break;
            case 'patch':
                result = await client.patch(path, body);
                break;
            case 'delete':
                result = await client.delete(path, query);
                break;
        }
    }

    const unwrap = opts.unwrap ?? DEFAULT_UNWRAP[op];
    const unwrapped = unwrapResponse(result, unwrap);

    if (opts.map) {
        return opts.map(unwrapped as TRaw, params);
    }

    return toTypedResult<R>(unwrapped);
};

export const createService = <const T extends Record<string, unknown>>(config: ServiceConfig, methods: T): BuiltService<T> => {
    const clientDescs = typeof config === 'string'
        ? createDefaultClients(config)
        : 'clients' in config
            ? config.clients
            : createDefaultClients(config.basePath);
    const defaultClientName = firstClientName(clientDescs);
    const cache = new Map<string, VoltClient>();

    const resolve = (name: string, params: unknown): VoltClient => {
        const desc = clientDescs[name];
        if (!desc) throw new Error(`createService: unknown client '${name}'`);

        if (desc.getTeamId) {
            return createApiClient(desc.basePath, {
                useRBAC: desc.useRBAC,
                getTeamId: () => desc.getTeamId?.(params) ?? null
            });
        }

        let client = cache.get(name);
        if (!client) {
            client = createApiClient(desc.basePath, {
                useRBAC: desc.useRBAC
            });
            cache.set(name, client);
        }

        return client;
    };

    const service = Object.create(null) as BuiltService<T>;
    const mutableService = service as Record<string, (params: unknown) => Promise<unknown>>;

    for (const [name, value] of Object.entries(methods)) {
        if (!isDescriptor(value)) {
            continue;
        }

        const desc = value;
        mutableService[name] = async (params: unknown) => {
            const clientName = desc.opts?.client ?? defaultClientName;

            if (desc.kind === 'custom') {
                desc.opts?.validate?.(params);

                const clients = Object.fromEntries(
                    Object.keys(clientDescs).map((clientKey) => [clientKey, resolve(clientKey, params)])
                );

                return desc.run!(
                    {
                        clients,
                        getClient: (requestedName?: string) => resolve(requestedName ?? clientName, params)
                    },
                    params
                );
            }

            return execute(resolve(clientName, params), desc, params);
        };
    }

    return service;
};

export const get = <P, R, TRaw = unknown>(path: PathLike<P>, opts?: MethodOpts<P, R, TRaw>): Descriptor<P, R, TRaw> => {
    return {
        kind: 'standard',
        op: 'get',
        path,
        opts
    };
};

export const post = <P, R, TRaw = unknown>(path: PathLike<P>, opts?: MethodOpts<P, R, TRaw>): Descriptor<P, R, TRaw> => {
    return {
        kind: 'standard',
        op: 'post',
        path,
        opts
    };
};

export const patch = <P, R, TRaw = unknown>(path: PathLike<P>, opts?: MethodOpts<P, R, TRaw>): Descriptor<P, R, TRaw> => {
    return {
        kind: 'standard',
        op: 'patch',
        path,
        opts
    };
};

export const del = <P, R = void, TRaw = unknown>(path: PathLike<P>, opts?: MethodOpts<P, R, TRaw>): Descriptor<P, R, TRaw> => {
    return {
        kind: 'standard',
        op: 'delete',
        path,
        opts
    };
};

export const paginated = <P, R, TRaw = unknown>(path: PathLike<P>, opts?: MethodOpts<P, R, TRaw>): Descriptor<P, R, TRaw> => {
    return {
        kind: 'standard',
        op: 'getPaginated',
        path,
        opts
    };
};

export const request = <P, R, TRaw = unknown>(method: HttpMethod, path: PathLike<P>, opts?: MethodOpts<P, R, TRaw>): Descriptor<P, R, TRaw> => {
    return {
        kind: 'standard',
        op: 'request',
        httpMethod: method,
        path,
        opts
    };
};

export const download = <P>(
    method: HttpMethod,
    path: PathLike<P>,
    opts?: Omit<MethodOpts<P, Blob, Blob>, 'unwrap' | 'responseType'>
): Descriptor<P, Blob, Blob> => {
    const downloadOpts: MethodOpts<P, Blob, Blob> = {
        ...opts,
        responseType: 'blob',
        unwrap: 'raw'
    };

    return {
        kind: 'standard',
        op: 'request',
        httpMethod: method,
        path,
        opts: downloadOpts
    };
};

export const custom = <P, R>(
    run: (ctx: ServiceExecutionContext, params: P) => Promise<R> | R,
    opts?: Pick<MethodOpts<P, R>, 'validate'>
): Descriptor<P, R> => {
    return {
        kind: 'custom',
        run,
        opts
    };
};
