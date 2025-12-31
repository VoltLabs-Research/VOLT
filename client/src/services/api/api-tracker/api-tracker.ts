import VoltClient from '@/api';
import type { GetApiTrackerParams, ApiTrackerRequest } from './types';

const client = new VoltClient('/api-tracker');

export default {
    async getAll(params?: GetApiTrackerParams): Promise<ApiTrackerRequest[]> {
        const response = await client.request('get', '/', { query: params });
        return response.data.data;
    }
};
