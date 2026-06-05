import { AI_PROVIDERS, AI_PROVIDER_DESCRIPTIONS, AI_PROVIDER_NAMES } from '@modules/ai/domain/contracts/AIProviders';
import { TeamAIProvider } from '@modules/team/domain/entities/ai-integration/TeamAIIntegration';
import type { ITeamAIProviderCatalog, TeamAIProviderMetadata } from '@modules/team/domain/port/ai-integration/ITeamAIProviderCatalog';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';

export type { TeamAIProviderMetadata };

const buildTeamAIProviderCatalog = (): Map<TeamAIProvider, TeamAIProviderMetadata> => {
    const entries = AI_PROVIDERS.map((provider) => {
        const metadata: TeamAIProviderMetadata = {
            id: provider,
            name: AI_PROVIDER_NAMES[provider],
            description: AI_PROVIDER_DESCRIPTIONS[provider]
        };

        return [provider, metadata] as const;
    });

    return new Map(entries);
};

@Singleton(TEAM_TOKENS.TeamAIProviderCatalog)
export default class TeamAIProviderCatalog implements ITeamAIProviderCatalog {
    private readonly catalog = buildTeamAIProviderCatalog();

    isSupported(provider: string): provider is TeamAIProvider {
        return this.catalog.has(provider as TeamAIProvider);
    }

    getProviderMetadata(provider: TeamAIProvider): TeamAIProviderMetadata {
        const metadata = this.catalog.get(provider);
        if (!metadata) {
            throw new Error(`Unsupported provider: ${provider}`);
        }

        return metadata;
    }

    getAllProviderMetadata(): TeamAIProviderMetadata[] {
        return Array.from(this.catalog.values());
    }

    normalize(provider: string): TeamAIProvider | null {
        const normalized = provider.toLowerCase().trim();
        if (this.isSupported(normalized)) {
            return normalized;
        }
        return null;
    }
};
