import type { TeamAIProvider } from '@modules/team/domain/entities/ai-integration/TeamAIIntegration';

export interface TeamAIProviderMetadata {
    id: TeamAIProvider;
    name: string;
    description: string;
}

export interface ITeamAIProviderCatalog {
    isSupported(provider: string): provider is TeamAIProvider;
    getProviderMetadata(provider: TeamAIProvider): TeamAIProviderMetadata;
    getAllProviderMetadata(): TeamAIProviderMetadata[];
    normalize(provider: string): TeamAIProvider | null;
}
