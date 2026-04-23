import { ApiError, extractServerCode } from '@voltstack/voltclient';
import axios from 'axios';
import type { AxiosProgressEvent, AxiosRequestConfig, AxiosInstance } from 'axios';
import type { CredentialProvider, HttpClient, HttpRequest } from '@voltstack/voltclient';

interface CreateInstrumentedHttpClientOptions {
    baseUrl: string;
    credential?: CredentialProvider;
    timeout: number;
};

const DEFAULT_HTTP_TIMEOUT_MS = 30_000;
const DISABLED_HTTP_TIMEOUT_MS = 0;
const SLOW_REQUEST_THRESHOLD_MS = 2_000;
const HOTSPOT_WARN_THRESHOLD_MS = 1_000;

const HTTP_STATUS_CODES: Record<number, string> = {
    400: 'Http::400',
    401: 'Http::401',
    403: 'Http::403',
    404: 'Http::404',
    409: 'Http::409',
    429: 'Http::429',
    500: 'Http::500',
    502: 'Http::502',
    503: 'Http::503',
    504: 'Http::504'
};

let clientTraceId: string | null = null;

const createTraceId = (): string => {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const logInstrumentation = (
    label: string,
    durationMs: number,
    metadata?: Record<string, unknown>,
    warn = false
): void => {
    const shouldDebugLog = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true';

    if (!warn && !shouldDebugLog) {
        return;
    }

    const logger = warn ? console.warn : console.debug;
    logger(`[client] ${label} ${Math.round(durationMs)}ms`, metadata ?? {});
};

class InstrumentedHttpClient implements HttpClient {
    private readonly api: AxiosInstance;
    private readonly defaultTimeoutMs: number;

    constructor({ baseUrl, credential, timeout }: CreateInstrumentedHttpClientOptions) {
        this.defaultTimeoutMs = timeout;
        this.api = axios.create({
            baseURL: baseUrl,
            withCredentials: true
        });

        this.api.interceptors.request.use(async (config) => {
            config.headers = config.headers ?? {};
            config.headers['x-trace-id'] = getClientTraceId();

            const token = credential ? await credential.getToken() : null;
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }

            return config;
        });
    }

    async request<T>(request: HttpRequest): Promise<T> {
        const requestStart = performance.now();
        const requestTimeoutMs = typeof Reflect.get(request, 'timeoutMs') === 'number'
            ? Number(Reflect.get(request, 'timeoutMs'))
            : request.responseType === 'blob'
                ? DISABLED_HTTP_TIMEOUT_MS
                : this.defaultTimeoutMs;

        const headers = { ...(request.headers ?? {}) };
        const hasExplicitContentType = headers['Content-Type'] !== undefined || headers['content-type'] !== undefined;

        if (request.body instanceof FormData) {
            delete headers['Content-Type'];
            delete headers['content-type'];
        } else if (request.body !== undefined && !hasExplicitContentType) {
            headers['Content-Type'] = 'application/json';
        }

        const config: AxiosRequestConfig = {
            method: request.method,
            url: request.url,
            params: request.query,
            data: request.body,
            headers,
            signal: request.signal,
            timeout: requestTimeoutMs,
            responseType: request.responseType ?? 'json',
            onUploadProgress: request.onUploadProgress
                ? (event: AxiosProgressEvent) => {
                    request.onUploadProgress?.({
                        loaded: event.loaded,
                        total: event.total
                    });
                }
                : undefined
        };

        try {
            const response = await this.api.request<T>(config);
            const durationMs = performance.now() - requestStart;

            if (durationMs >= SLOW_REQUEST_THRESHOLD_MS) {
                logInstrumentation('http.slow', durationMs, {
                    method: request.method,
                    url: request.url,
                    traceId: getClientTraceId()
                });
            }

            if (response.status === 204 || response.headers['content-length'] === '0') {
                return undefined as T;
            }

            return response.data;
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }

            if (axios.isCancel(error)) {
                throw error;
            }

            if (!axios.isAxiosError(error)) {
                throw new ApiError('Internal::Server::Error', undefined, error);
            }

            if (error.code === 'ERR_CANCELED') {
                throw error;
            }

            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                const durationMs = performance.now() - requestStart;
                logInstrumentation('http.timeout', durationMs, {
                    method: request.method,
                    url: request.url,
                    traceId: getClientTraceId()
                }, true);
                throw new ApiError('Network::Timeout', undefined, error);
            }

            if (!error.response) {
                throw new ApiError('Network::ConnectionError', undefined, error);
            }

            const codeFromServer = extractServerCode(error.response.data);
            const fallbackCode = HTTP_STATUS_CODES[error.response.status] ?? 'Internal::Server::Error';
            throw new ApiError(codeFromServer ?? fallbackCode, error.response.status, error);
        }
    }
}

const getClientTraceId = (): string => {
    if (!clientTraceId) {
        clientTraceId = createTraceId();
    }

    return clientTraceId;
};

export const createSocketTraceAuth = (): Record<string, string> => {
    return { traceId: getClientTraceId() };
};

export const reportHotspotDuration = (
    label: string,
    startedAt: number,
    metadata?: Record<string, unknown>
): void => {
    const durationMs = performance.now() - startedAt;
    logInstrumentation(label, durationMs, metadata, durationMs >= HOTSPOT_WARN_THRESHOLD_MS);
};

export const createInstrumentedHttpClient = (options: CreateInstrumentedHttpClientOptions): HttpClient => {
    return new InstrumentedHttpClient(options);
};

export { DEFAULT_HTTP_TIMEOUT_MS };
