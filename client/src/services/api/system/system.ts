import VoltClient from '@/api';
import type { SystemStats } from './types';

const client = new VoltClient('/system');

const systemApi = {
    async getStats(): Promise<SystemStats>{
        const response = await client.request<{ status: string; data: { stats: SystemStats } }>('get', '/stats');
        return response.data.data.stats;
    }
};

export default systemApi;
