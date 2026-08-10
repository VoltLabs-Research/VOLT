import axios from 'axios';
import ApiError from '../errors/ApiError';
import extractServerCode from '../errors/extract-server-code';
import { getHttpFallbackCode, toParams } from './http-utils';
import type { CredentialProvider } from '../auth/CredentialProvider';
import type { HttpClient, HttpRequest } from './HttpClient';
import type { AxiosInstance } from 'axios';

export interface AxiosHttpClientOpts {
    baseUrl: string;
    credential?: CredentialProvider;
    /** Request timeout in ms. Default: 30 000. */
    timeout?: number;
};

/**
 * Axios-backed implementation of `HttpClient`.
 * Prefer this adapter when upload progress reporting (`onUploadProgress`) is needed,
 * since the Fetch API does not expose upload progress events.
 *
 * Requires `axios` as a peer dependency.
 */
export default class AxiosHttpClient implements HttpClient {
    private readonly api: AxiosInstance;
    private readonly credential: CredentialProvider | undefined;

    constructor(opts: AxiosHttpClientOpts) {
        this.credential = opts.credential;

        this.api = axios.create({
            baseURL: opts.baseUrl,
            headers: { 'Content-Type': 'application/json' },
            timeout: opts.timeout ?? 30_000
        });

        this.api.interceptors.request.use(async (config) => {
            const token = this.credential ? await this.credential.getToken() : null;
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }

            if (config.data instanceof FormData) {
                delete config.headers['Content-Type'];
            }

            return config;
        });
    }

    private toApiError(error: unknown): ApiError {
        if (error instanceof ApiError) return error;

        if (axios.isCancel(error)) throw error;

        if (!axios.isAxiosError(error)) {
            return new ApiError('Internal::Server::Error', undefined, error);
        }

        if (error.code === 'ERR_CANCELED') throw error;

        if (error.code === 'ECONNABORTED') {
            return new ApiError('Network::Timeout', undefined, error);
        }

        if (!error.response) {
            return new ApiError('Network::ConnectionError', undefined, error);
        }

        const codeFromServer = extractServerCode(error.response.data);
        const fallbackCode = getHttpFallbackCode(error.response.status);

        return new ApiError(codeFromServer ?? fallbackCode, error.response.status, error);
    }

    async request<T>(req: HttpRequest): Promise<T> {
        try {
            const res = await this.api.request<T>({
                method: req.method,
                url: req.url,
                params: toParams(req.query),
                data: req.body,
                headers: req.headers,
                signal: req.signal,
                responseType: req.responseType,
                onUploadProgress: req.onUploadProgress
            });
            return res.data;
        } catch (error: unknown) {
            throw this.toApiError(error);
        }
    }
};
