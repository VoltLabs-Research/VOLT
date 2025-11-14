import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { generateDeduplicationKey } from '@/api/request-deduplicator';
import { classifyError } from '@/api/error';
import { notifyApiError } from '@/api/error-notification';

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
        const classifiedError = classifyError(error);
        
        // Log detailed information for developers (console - dev tools only)
        console.error('API Error Details:', {
            userMessage: classifiedError.getUserMessage?.(),
            detailedMessage: classifiedError.getDetailedMessage?.(),
            context: classifiedError.context,
            type: classifiedError.type,
            status: classifiedError.status
        });
        
        notifyApiError(classifiedError);
        return Promise.reject(classifiedError);
    });
};