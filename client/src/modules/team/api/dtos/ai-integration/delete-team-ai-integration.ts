import type { AIProvider } from '@/modules/ai/api/entities/ai-provider';

export interface DeleteTeamAIIntegrationInputDTO {
    teamId: string;
    provider: AIProvider;
}
