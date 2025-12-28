import VoltClient from '@/api';
import type { SystemStats, RBACConfig } from './types';

const client = new VoltClient('/system');

const systemApi = {
    async getStats(): Promise<SystemStats> {
        const response = await client.request<{ status: string; data: { stats: SystemStats } }>('get', '/stats');
        return response.data.data.stats;
    },

    async getRBACConfig(): Promise<RBACConfig> {
        const response = await client.request<{ status: string; data: RBACConfig }>('get', '/rbac');
        return response.data.data;
    }
};

export default systemApi;

