import VoltClient from '@/api';
import type { SystemStats, GetSystemStats, RBACConfig } from './types';
import type { ApiResponse } from '@/types/api';

const client = new VoltClient('/system');

const systemApi = {
    async getStats(): Promise<SystemStats> {
        const response = await client.request<ApiResponse<GetSystemStats>>('get', '/stats');
        return response.data.data.stats;
    },

    async getRBACConfig(): Promise<RBACConfig> {
        const response = await client.request<ApiResponse<RBACConfig>>('get', '/rbac');
        return response.data.data;
    }
};

export default systemApi;

