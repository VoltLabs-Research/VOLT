import type { TeamAIProvider } from '@modules/team/domain/entities/TeamAIIntegration';

export interface AIDiscoveredModel {
    id: string;
    name: string;
    description?: string;
}

export interface IAIProviderModelDiscovery {
    fetchModels(
        provider: TeamAIProvider,
        apiKey: string,
        metadata?: Record<string, unknown>
    ): Promise<AIDiscoveredModel[]>;
}
