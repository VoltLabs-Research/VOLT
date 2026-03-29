import { ApiError, extractServerCode } from '@voltstack/voltclient';
import axios from 'axios';
import type { AxiosProgressEvent, AxiosRequestConfig } from 'axios';
import type { CredentialProvider, HttpClient, HttpHeaders, HttpRequest } from '@voltstack/voltclient';

interface CreateInstrumentedHttpClientOptions {
    baseUrl: string;
    credential?: CredentialProvider;
    timeout: number;
};

interface TimeoutSignalResult {
    signal?: AbortSignal;
    cleanup: () => void;
    didTimeout: () => boolean;
};

const DEFAULT_HTTP_TIMEOUT_MS = 30_000;
const DISABLED_HTTP_TIMEOUT_MS = 0;
const SLOW_REQUEST_THRESHOLD_MS = 2_000;
const HOTSPOT_WARN_THRESHOLD_MS = 1_000;

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
    if (!warn && !import.meta.env.DEV) {
        return;
    }

    const logger = warn ? console.warn : console.debug;
    logger(`[client] ${label} ${Math.round(durationMs)}ms`, metadata ?? {});
};

const buildTimeoutSignal = (signal: AbortSignal | undefined, timeoutMs: number): TimeoutSignalResult => {
    if (timeoutMs <= 0) {
        return {
            signal,
            cleanup: () => undefined,
            didTimeout: () => false
        };
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
        timedOut = true;
        controller.abort(new DOMException(`Request timed out after ${timeoutMs}ms`, 'TimeoutError'));
    }, timeoutMs);

    const abortFromSource = () => {
        controller.abort(signal?.reason);
    };

    if (signal?.aborted) {
        abortFromSource();
    } else {
        signal?.addEventListener('abort', abortFromSource, { once: true });
    }

    return {
        signal: controller.signal,
        cleanup: () => {
            window.clearTimeout(timeoutId);
            signal?.removeEventListener('abort', abortFromSource);
        },
        didTimeout: () => timedOut
    };
};

const buildTraceHeaders = (headers?: HttpHeaders): HttpHeaders => {
    return {
        ...headers,
        'x-trace-id': getClientTraceId()
    };
};

const getHttpFallbackCode = (status: number): string => {
    if (status === 400) {
        return 'Http::400';
    }

    if (status === 401) {
        return 'Http::401';
    }

    if (status === 403) {
        return 'Http::403';
    }

    if (status === 404) {
        return 'Http::404';
    }

    if (status === 409) {
        return 'Http::409';
    }

    if (status === 429) {
        return 'Http::429';
    }

    if (status === 500) {
        return 'Http::500';
    }

    if (status === 502) {
        return 'Http::502';
    }

    if (status === 503) {
        return 'Http::503';
    }

    if (status === 504) {
        return 'Http::504';
    }

    return 'Internal::Server::Error';
};

class BrowserAxiosHttpClient implements HttpClient {
    private readonly api = axios.create({
        headers: {
            'Content-Type': 'application/json'
        },
        timeout: DISABLED_HTTP_TIMEOUT_MS,
        withCredentials: true
    });

    constructor(
        private readonly baseUrl: string,
        private readonly credential?: CredentialProvider
    ) {}

    async request<T>(request: HttpRequest): Promise<T> {
        const token = this.credential ? await this.credential.getToken() : null;
        const headers = buildTraceHeaders(request.headers);

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        if (request.body instanceof FormData) {
            delete headers['Content-Type'];
        }

        try {
            const config: AxiosRequestConfig = {
                baseURL: this.baseUrl,
                method: request.method,
                url: request.url,
                params: request.query,
                data: request.body,
                headers,
                signal: request.signal,
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
            const response = await this.api.request<T>(config);

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

            if (error.code === 'ECONNABORTED') {
                throw new ApiError('Network::Timeout', undefined, error);
            }

            if (!error.response) {
                throw new ApiError('Network::ConnectionError', undefined, error);
            }

            const codeFromServer = extractServerCode(error.response.data);
            const fallbackCode = getHttpFallbackCode(error.response.status);
            throw new ApiError(codeFromServer ?? fallbackCode, error.response.status, error);
        }
    }
}

class InstrumentedHttpClient implements HttpClient {
    private readonly transport: BrowserAxiosHttpClient;
    private readonly timeoutMs: number;

    constructor({ baseUrl, credential, timeout }: CreateInstrumentedHttpClientOptions) {
        this.transport = new BrowserAxiosHttpClient(baseUrl, credential);
        this.timeoutMs = timeout;
    }

    async request<T>(request: HttpRequest): Promise<T> {
        const requestStart = performance.now();
        const requestTimeoutMs = typeof Reflect.get(request, 'timeoutMs') === 'number'
            ? Number(Reflect.get(request, 'timeoutMs'))
            : request.responseType === 'blob'
                ? DISABLED_HTTP_TIMEOUT_MS
                : this.timeoutMs;
        const timeout = buildTimeoutSignal(request.signal, requestTimeoutMs);

        try {
            const response = await this.transport.request<T>({
                ...request,
                headers: buildTraceHeaders(request.headers),
                signal: timeout.signal
            });
            const durationMs = performance.now() - requestStart;

            if (durationMs >= SLOW_REQUEST_THRESHOLD_MS) {
                logInstrumentation('http.slow', durationMs, {
                    method: request.method,
                    url: request.url,
                    traceId: getClientTraceId()
                });
            }

            return response;
        } catch (error) {
            const durationMs = performance.now() - requestStart;

            if (timeout.didTimeout()) {
                logInstrumentation('http.timeout', durationMs, {
                    method: request.method,
                    url: request.url,
                    traceId: getClientTraceId()
                }, true);
            }

            throw error;
        } finally {
            timeout.cleanup();
        }
    }
}

export const getClientTraceId = (): string => {
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
