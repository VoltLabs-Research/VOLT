import VoltClient from '@/api';
import type { AnalysisConfig } from './types';
import type { PaginatedResponse } from '@/types/api';

const client = new VoltClient('/analysis-config', { useRBAC: true });

export default {
    async getByTeamId(params?: { page?: number; limit?: number; q?: string }): Promise<PaginatedResponse<AnalysisConfig>>{
        const response = await client.request('get', '/', { query: params });
        return response.data;
    },

    async delete(id: string): Promise<void>{
        await client.request('delete', `/${id}`);
    }
};