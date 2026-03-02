import { injectable } from 'tsyringe';
import { TeamAIProvider } from '@modules/team/domain/entities/TeamAIIntegration';
import { AI_PROVIDERS, AI_PROVIDER_NAMES } from '@modules/ai/domain/constants/AIProviders';

export interface TeamAIProviderMetadata {
    id: TeamAIProvider;
    name: string;
}

export interface TeamAIModelMetadata {
    id: string;
    name: string;
    description?: string;
}

@injectable()
export default class TeamAIProviderCatalog {
    private readonly catalog: Record<TeamAIProvider, TeamAIProviderMetadata> = AI_PROVIDERS.reduce(
        (catalog, provider) => {
            catalog[provider] = { id: provider, name: AI_PROVIDER_NAMES[provider] };
            return catalog;
        },
        {} as Record<TeamAIProvider, TeamAIProviderMetadata>
    );

    isSupported(provider: string): provider is TeamAIProvider {
        return Object.prototype.hasOwnProperty.call(this.catalog, provider);
    }

    getProviderMetadata(provider: TeamAIProvider): TeamAIProviderMetadata {
        return this.catalog[provider];
    }

    getAllProviderMetadata(): TeamAIProviderMetadata[] {
        return Object.values(this.catalog);
    }

    normalize(provider: string): TeamAIProvider | null {
        const normalized = provider.toLowerCase().trim();
        if (this.isSupported(normalized)) {
            return normalized;
        }
        return null;
    }
}
