import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { setupInterceptors } from '@/api/interceptors';
import { requestDeduplicator, generateDeduplicationKey } from '@/api/request-deduplicator';
import { classifyError } from '@/api/error';

export type HttpMethod = 'get' | 'post' | 'patch' | 'delete';

export interface RetryConfig{
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    retryableStatuses: number[];
};

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 3,
    retryableStatuses: [408, 429, 500, 502, 503, 504, 401, 403, 404],
};

export type RequestArgs<M extends HttpMethod> = M extends 'get' | 'delete'
    ? {
        config?: AxiosRequestConfig;
        data?: never;
        dedupe?: boolean;
        retry?: Partial<RetryConfig>;
    } : {
        config?: AxiosRequestConfig;
        data?: any;
        dedupe?: never;
        retry?: Partial<RetryConfig>;
    };

const sleep = (ms: number) => {
    return new Promise((r) => setTimeout(r, ms));
};

const withRetry = async <T>(fn: () => Promise<T>, cfg: RetryConfig): Promise<T> => {
    let lastError: any;

    for(let attempt = 0; attempt < cfg.maxRetries; attempt++){
        try{
            return await fn();
        }catch(error: any){
            lastError = error;

            const status = error?.response?.status;
            
            if(!cfg.retryableStatuses.includes(status)) throw error;
            if(attempt >= cfg.maxRetries - 1) break;

            const baseDelay = Math.min(
                cfg.initialDelay * Math.pow(cfg.backoffMultiplier, attempt),
                cfg.maxDelay
            );

            const jitter = Math.random() * 0.1 * baseDelay;
            await sleep(baseDelay + jitter);
        }
    }

    throw lastError;
};

export default class APICore{
    public readonly instance: AxiosInstance;
    private readonly baseURL: string;
    private readonly defaultRetry: RetryConfig;

    constructor(options?: {
        baseURL: string;
        headers?: Record<string, string>;
        retry?: Partial<RetryConfig>;
    }){
        this.baseURL = options?.baseURL ?? '';
        this.defaultRetry = { ...DEFAULT_RETRY_CONFIG, ...(options?.retry ?? {}) };
        this.instance = axios.create({
            baseURL: this.baseURL,
            headers: {
                "Content-Type": "application/json",
                ...(options?.headers ?? {}),
            },
        });

        setupInterceptors(this.instance);
    }

    private resolveEntry(override?: Partial<RetryConfig>){
        return { ...this.defaultRetry, ...(override ?? {}) };
    }

    async request<T = any, M extends HttpMethod = HttpMethod>(
        method: M,
        url: string,
        args: RequestArgs<M> = {} as RequestArgs<M>
    ): Promise<{ data: T }>{
        try{
            const retryCfg = this.resolveEntry(args.retry);
            const config = args.config;

            const doRequest = async () => {
                const resp = await this.instance.request<T>({
                    method,
                    url,
                    ...(method === "get" || method === "delete" ? {} : { data: args.data }),
                    ...(config ?? {})
                });
                return resp.data;
            };

            const canDedupe = method === "get" && !(config?.signal) && (args.dedupe ?? true) === true;

            if(!canDedupe){
                const data = await withRetry(doRequest, retryCfg);
                return { data };
            }

            const key = generateDeduplicationKey('GET', url);
            const data = await requestDeduplicator.deduplicate(key, () => withRetry(doRequest, retryCfg));
            return { data };
        }catch(error){
            throw classifyError(error);
        }
    }
};