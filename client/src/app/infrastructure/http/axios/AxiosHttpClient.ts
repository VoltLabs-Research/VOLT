import axios, { AxiosError, AxiosInstance } from 'axios';
import { HttpClient, HttpRequest } from '@/app/core/http/HttpClient';
import ApiError from '@/shared/errors/ApiError';
import extractServerCode from './extract-server-code';

export interface AxiosHttpClientOpts{
    baseUrl: string;
    getToken: () => string | null;
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

        const codeFromServer = extractServerCode(error.response.data) || 'Internal::Server::Error';
        return new ApiError(codeFromServer, error.response.status, error);
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