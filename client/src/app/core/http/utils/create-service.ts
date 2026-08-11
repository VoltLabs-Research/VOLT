import { createApiClient } from '@/app/core/http/utils/create-client';
import {
    createService as sdkCreateService,
    get,
    post,
    patch,
    del,
    paginated,
    request,
    download,
    custom
} from '@voltstack/voltclient';
import type { MethodOpts } from '@voltstack/voltclient';
import type { Endpoint } from '@volt/contracts/shared/routing';
export { get, post, patch, del, paginated, request, download, custom };

type EndpointPath<P> = string | ((params: P) => string);

export const put = <P, R, TRaw = unknown>(
    path: EndpointPath<P>,
    opts?: MethodOpts<P, R, TRaw>
): ReturnType<typeof request<P, R, TRaw>> => {
    return request<P, R, TRaw>('PUT', path, opts);
};

const API_PREFIX = '/api';

interface ServiceRoutesOptions {
    rbac?: boolean;
}

export const serviceRoutes = (basePath: string, options?: ServiceRoutesOptions) => {
    const prefix = `${API_PREFIX}${basePath}${options?.rbac ? '/:teamId' : ''}`;

    const pathOf = (endpoint: Endpoint<never, unknown>): string => {
        if (endpoint.path !== prefix && !endpoint.path.startsWith(`${prefix}/`)) {
            throw new Error(`Route "${endpoint.path}" does not belong under "${prefix}"`);
        }

        return endpoint.path.slice(prefix.length) || '/';
    };

    const route = <P, R, TRaw = unknown>(endpoint: Endpoint<never, unknown>, opts?: MethodOpts<P, R, TRaw>) => {
        const path = pathOf(endpoint);

        switch (endpoint.method) {
            case 'GET': return get<P, R, TRaw>(path, opts);
            case 'POST': return post<P, R, TRaw>(path, opts);
            case 'PATCH': return patch<P, R, TRaw>(path, opts);
            case 'DELETE': return del<P, R, TRaw>(path, opts);
            default: return request<P, R, TRaw>(endpoint.method, path, opts);
        }
    };

    return {
        path: pathOf,
        route
    };
};

export const createService = <const T extends Record<string, unknown>>(
    config: Parameters<typeof sdkCreateService>[0],
    methods: T
): ReturnType<typeof sdkCreateService<T>> => {
    return sdkCreateService(config, methods, createApiClient);
};
