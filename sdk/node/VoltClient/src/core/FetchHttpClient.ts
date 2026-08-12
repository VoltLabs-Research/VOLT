import ApiError from '../errors/ApiError';
import extractServerCode from '../errors/extract-server-code';
import { getHttpFallbackCode, toParams } from './http-utils';
import type { CredentialProvider } from '../auth/CredentialProvider';
import type { HttpClient, HttpQuery, HttpRequest } from './HttpClient';

const DEFAULT_TIMEOUT_MS = 30_000;

export interface FetchHttpClientOpts {
    baseUrl: string;
    credential?: CredentialProvider;
    timeout?: number;
};

export default class FetchHttpClient implements HttpClient {
    private readonly baseUrl: string;
    private readonly credential: CredentialProvider | undefined;
    private readonly timeoutMs: number;

    constructor(opts: FetchHttpClientOpts) {
        this.baseUrl = opts.baseUrl.replace(/\/$/, '');
        this.credential = opts.credential;
        this.timeoutMs = opts.timeout ?? DEFAULT_TIMEOUT_MS;
    }

    private async buildAuthHeaders(): Promise<Record<string, string>> {
        if (!this.credential) return {};

        const token = await this.credential.getToken();
        if (!token) return {};

        return { Authorization: `Bearer ${token}` };
    }

    private buildUrl(path: string, query?: HttpQuery): string {
        const params = toParams(query);
        const queryString = params && params.toString() ? `?${params.toString()}` : '';
        return `${this.baseUrl}${path}${queryString}`;
    }

    private buildSignal(callerSignal?: AbortSignal): AbortSignal {
        const timeout = AbortSignal.timeout(this.timeoutMs);

        if (!callerSignal) return timeout;

        return AbortSignal.any([timeout, callerSignal]);
    }

    private async toApiError(error: unknown, signal?: AbortSignal): Promise<never> {
        if (error instanceof ApiError) throw error;

        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        if (error instanceof Error && error.name === 'AbortError') throw error;

        if (error instanceof DOMException && error.name === 'TimeoutError') {
            throw new ApiError('Network::Timeout', undefined, error);
        }

        if (signal?.aborted) throw error;

        if (error instanceof TypeError) {
            throw new ApiError('Network::ConnectionError', undefined, error);
        }

        throw new ApiError('Internal::Server::Error', undefined, error);
    }

    async request<T>(req: HttpRequest): Promise<T> {
        const authHeaders = await this.buildAuthHeaders();
        const signal = this.buildSignal(req.signal);
        const url = this.buildUrl(req.url, req.query);

        const headers: Record<string, string> = { ...authHeaders, ...req.headers };

        let body: BodyInit | undefined;
        if (req.body !== undefined) {
            if (req.body instanceof FormData) {
                body = req.body;
            } else {
                headers['Content-Type'] = 'application/json';
                body = JSON.stringify(req.body);
            }
        }

        let response: Response;
        try {
            response = await fetch(url, {
                method: req.method,
                headers,
                body,
                signal
            });
        } catch (error: unknown) {
            return this.toApiError(error, signal);
        }

        if (!response.ok) {
            let errorData: unknown;
            try {
                errorData = await response.json();
            } catch {
                errorData = undefined;
            }

            const serverCode = extractServerCode(errorData);
            const fallbackCode = getHttpFallbackCode(response.status);
            throw new ApiError(serverCode ?? fallbackCode, response.status, errorData);
        }

        if (req.responseType === 'blob') {
            return response.blob() as Promise<T>;
        }

        if (req.responseType === 'text') {
            return response.text() as Promise<T>;
        }

        if (response.status === 204 || response.headers.get('content-length') === '0') {
            return undefined as T;
        }

        return response.json() as Promise<T>;
    }
};
