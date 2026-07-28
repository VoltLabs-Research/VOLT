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
import type { HttpMethod, MethodOpts } from '@voltstack/voltclient';
export { get, post, patch, del, paginated, request, download, custom };

type ServiceConfig = Parameters<typeof sdkCreateService>[0];

type EndpointPath<P> = string | ((params: P) => string);

const PUT_METHOD_UNSUPPORTED_BY_SDK = 'PUT' as unknown as HttpMethod;

export const put = <P, R, TRaw = unknown>(
    path: EndpointPath<P>,
    opts?: MethodOpts<P, R, TRaw>
): ReturnType<typeof request<P, R, TRaw>> => {
    return request<P, R, TRaw>(PUT_METHOD_UNSUPPORTED_BY_SDK, path, opts);
};

export const createService = <const T extends Record<string, unknown>>(
    config: ServiceConfig,
    methods: T
): ReturnType<typeof sdkCreateService<T>> => {
    return sdkCreateService(config, methods, createApiClient);
};
