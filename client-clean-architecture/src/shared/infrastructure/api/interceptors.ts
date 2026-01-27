import axios, { type AxiosInstance, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import { generateDeduplicationKey } from '@/shared/infrastructure/api/request-deduplicator';
import { classifyError } from '@/shared/infrastructure/api/error';
import { notifyApiError } from '@/shared/infrastructure/api/error-notification';

export interface RequestMetadata {
    startTime: number;
    deduplicationKey: string;
}

export const setupInterceptors = (axiosInstance: AxiosInstance): void => {
    axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig<any>) => {
        const token = localStorage.getItem('authToken');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        if (config.data instanceof FormData) {
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
        return response;
    }, (error) => {
        if (axios.isCancel(error) || error?.code === 'ERR_CANCELED') {
            return Promise.reject(error);
        }
        const classifiedError = classifyError(error);

        notifyApiError(classifiedError);
        return Promise.reject(classifiedError);
    });
};
