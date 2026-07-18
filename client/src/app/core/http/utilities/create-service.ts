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
export { get, post, patch, del, paginated, request, download, custom };

type ServiceConfig = Parameters<typeof sdkCreateService>[0];

export const createService = <const T extends Record<string, unknown>>(
    config: ServiceConfig,
    methods: T
): ReturnType<typeof sdkCreateService<T>> => {
    return sdkCreateService(config, methods, createApiClient);
};
