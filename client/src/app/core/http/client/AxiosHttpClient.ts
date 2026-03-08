import axios, { AxiosError, AxiosInstance } from 'axios';
import { HttpClient, HttpRequest } from '@/app/core/http/client/HttpClient';
import ApiError from '@/shared/errors/ApiError';
import extractServerCode from '../errors/extract-server-code';

export interface AxiosHttpClientOpts{
    baseUrl: string;
    getToken: () => string | null;
};

const getHttpFallbackCode = (status: number): string => {
    if(status === 400) return 'Http::400';
    if(status === 401) return 'Http::401';
    if(status === 403) return 'Http::403';
    if(status === 404) return 'Http::404';
    if(status === 409) return 'Http::409';
    if(status === 429) return 'Http::429';
    if(status === 500) return 'Http::500';
    if(status === 502) return 'Http::502';
    if(status === 503) return 'Http::503';
    if(status === 504) return 'Http::504';

    return 'Internal::Server::Error';
};

const toParams = (query?: Record<string, any>) => {
    if(!query) return undefined;

    const params = new URLSearchParams();
    for(const [k, v] of Object.entries(query)){
        if(v === undefined || v === null) continue;

        if(Array.isArray(v)){
            v.forEach((x) => params.append(k, String(x)));
        }else{
            params.set(k, String(v));
        }
    }

    return params;
};

export default class AxiosHttpClient implements HttpClient{
    private readonly api: AxiosInstance;

    constructor(
        opts: AxiosHttpClientOpts
    ){
        this.api = axios.create({
            baseURL: opts.baseUrl,
            headers: { 'Content-Type': 'application/json' }
        });

        // Send auth token
        this.api.interceptors.request.use((config) => {
            const token = opts.getToken();
            config.headers.Authorization = `Bearer ${token}`;

            if(config.data instanceof FormData){
                delete config.headers['Content-Type'];
            }

            return config;
        });
    }
    
    private toApiError(error: AxiosError): ApiError{
        if(error instanceof ApiError) return error;

        if(axios.isCancel(error) || error?.code === 'ERR_CANCELED') throw error;

        if(error?.code === 'ECONNABORTED'){
            return new ApiError('Network::Timeout', undefined, error);
        }

        if(!error?.response){
            return new ApiError("Network::ConnectionError", undefined, error);
        }

        const codeFromServer = extractServerCode(error.response.data);
        const fallbackCode = getHttpFallbackCode(error.response.status);

        return new ApiError(codeFromServer ?? fallbackCode, error.response.status, error);
    }

    async request<T>(req: HttpRequest): Promise<T>{
        try{
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
        }catch(error: any){
            throw this.toApiError(error);
        }
    }
};
