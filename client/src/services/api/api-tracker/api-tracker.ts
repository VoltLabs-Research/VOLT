import VoltClient from '@/api';
import type { GetApiTrackerParams, ApiTrackerRequest } from './types';

const client = new VoltClient('/api-tracker');

const apiTrackerApi = {
    async getAll(params?: GetApiTrackerParams): Promise<ApiTrackerRequest[]> {
        const response = await client.request<{ status: string; data: ApiTrackerRequest[] }>('get', '/', { query: params });
        return response.data.data;
    }
};

export default apiTrackerApi;
