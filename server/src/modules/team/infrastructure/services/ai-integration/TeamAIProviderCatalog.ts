import { AI_PROVIDERS, AI_PROVIDER_DESCRIPTIONS, AI_PROVIDER_NAMES } from '@modules/ai/domain/contracts/AIProviders';
import { TeamAIProvider } from '@modules/team/domain/entities/ai-integration/TeamAIIntegration';
import { Singleton } from '@shared/infrastructure/di/decorators';


export interface TeamAIProviderMetadata {
    id: TeamAIProvider;
    name: string;
    description: string;
};

export interface TeamAIModelMetadata {
    id: string;
    name: string;
    description?: string;
};

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

@Singleton()
export default class TeamAIProviderCatalog {
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
