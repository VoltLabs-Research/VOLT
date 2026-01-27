import VoltClient, { type VoltClientOptions } from '@/shared/infrastructure/api';
import type { ApiResponse } from '@/shared/types/api';
import type { HttpMethod, RequestArgs } from '@/shared/infrastructure/api/api-core';

export abstract class BaseRepository {
    protected readonly client: VoltClient;

    constructor(basePath: string, options?: VoltClientOptions) {
        this.client = new VoltClient(basePath, options);
    }

    protected async get<T>(path: string, args?: RequestArgs<HttpMethod>): Promise<T> {
        const response = await this.client.request<ApiResponse<T>>('get', path, args);
        return response.data.data;
    }

    protected async post<T>(path: string, data?: any, args?: RequestArgs<HttpMethod>): Promise<T> {
        const response = await this.client.request<ApiResponse<T>>('post', path, { ...args, data });
        return response.data.data;
    }

    protected async patch<T>(path: string, data?: any, args?: RequestArgs<HttpMethod>): Promise<T> {
        const response = await this.client.request<ApiResponse<T>>('patch', path, { ...args, data });
        return response.data.data;
    }

    protected async put<T>(path: string, data?: any, args?: RequestArgs<HttpMethod>): Promise<T> {
        const response = await this.client.request<ApiResponse<T>>('put', path, { ...args, data });
        return response.data.data;
    }

    protected async delete<T>(path: string, args?: RequestArgs<HttpMethod>): Promise<T> {
        const response = await this.client.request<ApiResponse<T>>('delete', path, args);
        return response.data.data;
    }
}
