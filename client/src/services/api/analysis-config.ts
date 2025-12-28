import VoltClient from '@/api';
import { getCurrentTeamId as getTeamId } from '@/stores/team/team';

const client = new VoltClient('/analysis-config', { useRBAC: true, getTeamId });

interface AnalysisConfig {
    _id: string;
    name: string;
    modifier: string;
    config: Record<string, any>;
    trajectory: string;
    [key: string]: any;
}

interface GetAnalysisConfigsResponse {
    configs: AnalysisConfig[];
    total: number;
    page: number;
    limit: number;
}

export default {
    async getByTeamId(params?: { page?: number; limit?: number; q?: string }): Promise<GetAnalysisConfigsResponse>{
        const response = await client.request<{ status: string; data: GetAnalysisConfigsResponse }>('get', { params });
        return response.data.data;
    },

    async delete(id: string): Promise<void>{
        await client.request('delete', `/${id}`);
    }
};