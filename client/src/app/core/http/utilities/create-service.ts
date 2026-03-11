import { createApiClient } from '@/app/core/http/utilities/create-client';
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
import type {
    EmptyParams,
    UnwrapMode,
    ClientDescriptor,
    ServiceExecutionContext,
    MethodOpts,
    BuiltService
} from '@voltstack/voltclient';

export type { EmptyParams, UnwrapMode, ClientDescriptor, ServiceExecutionContext, MethodOpts, BuiltService };
export { get, post, patch, del, paginated, request, download, custom };

type ServiceConfig = Parameters<typeof sdkCreateService>[0];

/**
 * Builds a typed service from a declarative descriptor map.
 * Thin wrapper around the SDK's `createService` that automatically injects
 * the frontend HTTP factory (`createApiClient`).
 *
 * @see `@voltstack/voltclient` for full DSL documentation.
 */
export const createService = <const T extends Record<string, unknown>>(
    config: ServiceConfig,
    methods: T
): ReturnType<typeof sdkCreateService<T>> => {
    return sdkCreateService(config, methods, createApiClient);
};
