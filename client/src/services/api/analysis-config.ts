import api from '@/api';
import getQueryParam from '@/utilities/get-query-param';

interface AnalysisConfig {
    _id: string;
    name: string;
    modifier: string;
    config: Record<string, any>;
    trajectory: string;
    [key: string]: any;
}

interface GetAnalysisConfigsParams {
    page?: number;
    limit?: number;
    search?: string;
    trajectoryId?: string;
}

interface GetAnalysisConfigsResponse {
    configs: AnalysisConfig[];
    total: number;
    page: number;
    limit: number;
}

const analysisConfigApi = {
    async getByTeamId(teamId: string, params?: { page?: number; limit?: number; q?: string }): Promise<GetAnalysisConfigsResponse>{
        const response = await api.get<{ status: string; data: GetAnalysisConfigsResponse }>(
            `/analysis-config/${teamId}`,
            { params }
        );
        return response.data.data;
    },

    async delete(id: string): Promise<void>{
        await api.delete(`/analysis-config/${getQueryParam('team')}/${id}`);
    }
};

export default analysisConfigApi;
