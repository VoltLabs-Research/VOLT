export type { HttpClient, HttpMethod, HttpQuery, HttpRequest, HttpResponseType, HttpHeaders, HttpProgressEvent } from './core/HttpClient';

export { default as FetchHttpClient } from './core/FetchHttpClient';
export type { FetchHttpClientOpts } from './core/FetchHttpClient';
export { default as AxiosHttpClient } from './core/AxiosHttpClient';
export type { AxiosHttpClientOpts } from './core/AxiosHttpClient';

export { default as VoltClient } from './core/VoltClient';
export type { VoltClientOptions, RequestArgs } from './core/VoltClient';

export type { CredentialProvider } from './auth/CredentialProvider';
export { staticToken, secretKey, dynamicToken } from './auth/presets';

export { default as ApiError } from './errors/ApiError';
export { ERROR_CODE_MESSAGES, getErrorMessage } from './errors/error-codes';
export { default as extractServerCode } from './errors/extract-server-code';

export type { PaginatedResponse, PaginationMeta } from './pagination/PaginationResponse';

export {
    createService,
    get,
    post,
    patch,
    del,
    paginated,
    request,
    download,
    custom
} from './dsl/create-service';
export type {
    ClientFactory,
    ClientDescriptor,
    ServiceExecutionContext,
    MethodOpts,
    BuiltService,
    EmptyParams,
    UnwrapMode
} from './dsl/create-service';

export { createVoltClient } from './factory/create-volt-client';
export type { VoltClientFactoryOptions } from './factory/create-volt-client';
