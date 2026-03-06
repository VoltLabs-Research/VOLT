import { injectable } from 'tsyringe';
import BaseRepository, { ApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import type ITeamAIIntegrationRepository from '@/modules/team/domain/port/ITeamAIIntegrationRepository';
import type {
    ListTeamAIIntegrationsResponse,
    ListTeamAIIntegrationModelsResponse,
    CreateTeamAIIntegrationParams,
    CreateTeamAIIntegrationResponse,
    UpdateTeamAIIntegrationParams,
    UpdateTeamAIIntegrationResponse
} from '@/modules/team/domain/port/ITeamAIIntegrationRepository';
import type { TeamAIProvider } from '@/modules/team/domain/entities/TeamAIIntegration';

@injectable()
export default class TeamAIIntegrationRepository extends BaseRepository implements ITeamAIIntegrationRepository {
    constructor() {
        super('/team/ai-integrations', { useRBAC: false });
    }

    async listByTeamId(teamId: string): Promise<ListTeamAIIntegrationsResponse> {
        const response = await this.client.get<ApiResponse<ListTeamAIIntegrationsResponse>>(`/${teamId}`);
        return this.unwrap(response);
    }

    async createByProvider(teamId: string, provider: TeamAIProvider, data: CreateTeamAIIntegrationParams): Promise<CreateTeamAIIntegrationResponse> {
        const response = await this.client.post<ApiResponse<CreateTeamAIIntegrationResponse>>(`/${teamId}/${provider}`, data);
        return this.unwrap(response);
    }

    async updateByProvider(teamId: string, provider: TeamAIProvider, data: UpdateTeamAIIntegrationParams): Promise<UpdateTeamAIIntegrationResponse> {
        const response = await this.client.patch<ApiResponse<UpdateTeamAIIntegrationResponse>>(`/${teamId}/${provider}`, data);
        return this.unwrap(response);
    }

    async deleteByProvider(teamId: string, provider: TeamAIProvider): Promise<void> {
        await this.client.delete(`/${teamId}/${provider}`);
    }

    async listModels(teamId: string): Promise<ListTeamAIIntegrationModelsResponse> {
        const response = await this.client.get<ApiResponse<ListTeamAIIntegrationModelsResponse>>(`/${teamId}/models`);
        return this.unwrap(response);
    }
}
