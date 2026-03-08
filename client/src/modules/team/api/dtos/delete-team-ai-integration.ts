import type { AIProvider } from '@/modules/ai/api/entities/ai-constants';

export interface DeleteTeamAIIntegrationInputDTO {
    teamId: string;
    provider: AIProvider;
};
