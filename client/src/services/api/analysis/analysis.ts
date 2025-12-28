import VoltClient from '@/api';
import type { GetAnalysisConfigsResponse } from './types';

const client = new VoltClient('/analysis-config', { useRBAC: true });

export default {
    async getByTeamId(params?: { page?: number; limit?: number; q?: string }): Promise<GetAnalysisConfigsResponse>{
        const response = await client.request<{ status: string; data: GetAnalysisConfigsResponse }>('get', { params });
        return response.data.data;
    },

    async delete(id: string): Promise<void>{
        await client.request('delete', `/${id}`);
    }
};