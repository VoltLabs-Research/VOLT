import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { generateDeduplicationKey } from '@/api/request-deduplicator';
import { classifyError } from '@/api/error';

export interface RequestMetadata{
    startTime: number;
    deduplicationKey: string;
}

export const setupInterceptors = (axiosInstance: AxiosInstance): void => {
    axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig<any>) => {
        const token = localStorage.getItem('authToken');
        if(token){
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        if(config.data instanceof FormData){
            delete config.headers['Content-Type'];
        }

        (config as any).metadata = {
            startTime: Date.now(),
            deduplicationKey: generateDeduplicationKey(
                config.method || 'GET',
                config.url || ''
            )
        };

        return config;
    }, (error) => Promise.reject(error));

    axiosInstance.interceptors.response.use((response: AxiosResponse<any>) => {
        // const duration = Date.now() - (response.config as any).metadata?.startTime;
        return response;
    }, (error) => {
        // const config = error.config as InternalAxiosRequestConfig & { metadata?: RequestMetadata };
        // const duration = Date.now() - config?.metadata?.startTime;

        return Promise.reject(classifyError(error));
    });
};