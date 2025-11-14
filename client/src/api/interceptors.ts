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
        
        // Handle 401 Unauthorized - redirect to sign in
        if (classifiedError.status === 401) {
            // Clear auth data
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            
            // Redirect to sign in page
            window.location.href = '/auth/sign-in';
            
            // Still return the error for error handling in components
            return Promise.reject(classifiedError);
        }
        
        notifyApiError(classifiedError);
        return Promise.reject(classifiedError);
    });
};