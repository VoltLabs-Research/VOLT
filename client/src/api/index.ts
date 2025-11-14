/**
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 **/

import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { setupInterceptors } from '@/api/interceptors';
import { requestDeduplicator, generateDeduplicationKey } from '@/api/request-deduplicator';
import { classifyError } from '@/api/error';

const API_BASE_URL = import.meta.env.VITE_API_URL + '/api';

/**
 * Retry configuration
 */
export interface RetryConfig{
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    retryableStatuses: number[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 3,
    retryableStatuses: [408, 429, 500, 502, 503, 504]
}

const createHttpClient = (): AxiosInstance => {
    const client = axios.create({
        baseURL: API_BASE_URL,
        // timeout: 30000,
        headers: {
            'Content-Type': 'application/json'
        }
    });

    setupInterceptors(client);
    return client;
};

/**
 * Retry mechanism with exponential backoff
 */
async function withRetry<T>(
    request: () => Promise<T>, 
    config: Partial<RetryConfig> = {}
): Promise<T>{
    const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    let lastError: any;

    for(let attempt = 0; attempt < finalConfig.maxRetries; attempt++){
        try{
            return await request();
        }catch(error: any){
            lastError = error;
            // Don't retry on certain errors
            if(
                error.response?.status === 401 ||
                error.response?.status === 403 ||
                error.response?.status === 404
            ){
                throw error;
            }

            // Check if retryable
            if(!finalConfig.retryableStatuses.includes(error.response?.status)){
                throw error;
            }

            if(attempt < finalConfig.maxRetries - 1){
                const delay = Math.min(
                    finalConfig.initialDelay * Math.pow(finalConfig.backoffMultiplier, attempt),
                    finalConfig.maxDelay
                );

                // Jitter to prevent thundering herd
                const jitter = Math.random() * 0.1 * delay;
                await new Promise((r) => setTimeout(r, delay + jitter));
            }
        }
    }

    throw lastError;
};

async function get<T = any>(
    client: AxiosInstance,
    url: string,
    config?: AxiosRequestConfig
): Promise<{ data: T }>{
    const deduplicationKey = generateDeduplicationKey('GET', url);

    return requestDeduplicator.deduplicate(deduplicationKey, async () => {
        const response = await withRetry(() => client.get<T>(url, config));
        return { data: response.data };
    });
};

async function mutate<T = any>(
    client: AxiosInstance,
    method: 'post' | 'put' | 'delete' | 'patch',
    url: string,
    data?: any,
    config?: AxiosRequestConfig
): Promise<{ data: T }>{
    const response = await withRetry(() => (
        client[method]<T>(url, data, config)
    ));
    return { data: response.data };
};

async function downloadBlob(
    client: AxiosInstance,
    url: string,
    filename: string,
    opts?: { onProgress?: (progress: number) => void }
): Promise<void> {
    try{
        const response = await withRetry(() => {
            return client.get<Blob>(url, {
                responseType: 'blob',
                onDownloadProgress: (evt) => {
                    const total = evt.total ?? 0
                    if(total > 0 && opts?.onProgress){
                        opts.onProgress(Math.min(1, Math.max(0, evt.loaded / total)));
                    }
                }
            });
        });

        const blob = response.data;
        const a = document.createElement('a');
        const objectUrl = URL.createObjectURL(blob);
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objectUrl);
    }catch(error: any){
        throw classifyError(error);
    }
};

async function downloadJson(
    client: AxiosInstance,
    url: string,
    filename: string,
    opts?: { onProgress?: (progress: number) => void }
): Promise<void>{
    try{
        const response = await withRetry(() => {
            return client.get<any>(url, {
                onDownloadProgress: (evt) => {
                    const total = evt.total ?? 0;
                    if(total > 0 && opts?.onProgress){
                        opts.onProgress(Math.min(1, Math.max(0, evt.loaded / total)));
                    }
                }
            })
        });

        const json = response.data?.data ?? response.data;
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });

        const a = document.createElement('a');
        const objectUrl = URL.createObjectURL(blob);
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objectUrl);
    }catch(error: any){
        throw classifyError(error);
    }
};

const httpClient = createHttpClient();

export const api = {
    // GET requests
    get: <T = any>(url: string, config?: AxiosRequestConfig) =>
        get<T>(httpClient, url, config),

    // POST requests
    post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
        mutate<T>(httpClient, 'post', url, data, config),

    // PUT requests
    put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
        mutate<T>(httpClient, 'put', url, data, config),

    // PATCH requests
    patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
        mutate<T>(httpClient, 'patch', url, data, config),

    // DELETE requests
    delete: <T = any>(url: string, config?: AxiosRequestConfig) =>
        mutate<T>(httpClient, 'delete', url, undefined, config),

    // Download utilities
    downloadBlob: (url: string, filename: string, opts?: { onProgress?: (progress: number) => void }) =>
        downloadBlob(httpClient, url, filename, opts),

    downloadJson: (url: string, filename: string, opts?: { onProgress?: (progress: number) => void }) =>
        downloadJson(httpClient, url, filename, opts),

    // Direct access to axios instance if needed
    instance: httpClient,

    // Utilities
    requestDeduplicator,
    classifyError 
};

// Named exports for compatibility
export { downloadBlob, downloadJson };

export default api;