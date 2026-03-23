import { AxiosHttpClient } from '@voltstack/voltclient';
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

class InstrumentedHttpClient implements HttpClient {
    private readonly transport: AxiosHttpClient;
    private readonly timeoutMs: number;

    constructor({ baseUrl, credential, timeout }: CreateInstrumentedHttpClientOptions) {
        this.transport = new AxiosHttpClient({
            baseUrl,
            credential,
            timeout
        });
        this.timeoutMs = timeout;
    }

    async request<T>(request: HttpRequest): Promise<T> {
        const requestStart = performance.now();
        const requestTimeoutMs = typeof Reflect.get(request, 'timeoutMs') === 'number'
            ? Number(Reflect.get(request, 'timeoutMs'))
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
