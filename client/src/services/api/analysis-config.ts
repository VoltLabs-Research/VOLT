import api from '@/api';

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
    async getAll(params?: GetAnalysisConfigsParams): Promise<GetAnalysisConfigsResponse> {
        const response = await api.get<{ status: string; data: GetAnalysisConfigsResponse }>('/analysis-config', { params });
        return response.data.data;
    },

    async getByTeamId(teamId: string, params?: { page?: number; limit?: number; q?: string }): Promise<GetAnalysisConfigsResponse> {
        const response = await api.get<{ status: string; data: GetAnalysisConfigsResponse }>(
            `/analysis-config/team/${teamId}`,
            { params }
        );
        return response.data.data;
    },

    async getByTrajectoryId(trajectoryId: string): Promise<AnalysisConfig[]> {
        const response = await api.get<{ status: string; data: AnalysisConfig[] }>(
            `/analysis-config/trajectory/${trajectoryId}`
        );
        return response.data.data;
    },

    async delete(id: string): Promise<void> {
        await api.delete(`/analysis-config/${id}`);
    },

    async getDislocations(id: string): Promise<any> {
        const response = await api.get<{ status: string; data: any }>(`/analysis-config/${id}/dislocations`);
        return response.data.data;
    },

    async executeAnalysis(
        modifierId: string,
        trajectoryId: string,
        config: Record<string, any>,
        timestep?: number
    ): Promise<string> {
        const response = await api.post<{ status: string; data: { analysisId: string } }>(
            `/plugins/${modifierId}/modifier/${modifierId}/trajectory/${trajectoryId}`,
            { config, timestep }
        );
        return response.data.data.analysisId;
    }
};

export default analysisConfigApi;
