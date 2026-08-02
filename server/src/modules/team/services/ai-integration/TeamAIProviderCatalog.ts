import { AI_PROVIDERS, AI_PROVIDER_DESCRIPTIONS, AI_PROVIDER_NAMES } from '@shared/contracts/types/AIProviders';
import type { TeamAIProvider } from '@modules/team/contracts/team-ai-integration';

interface TeamAIProviderMetadata {
    id: TeamAIProvider;
    name: string;
    description: string;
}

const CATALOG = new Map<TeamAIProvider, TeamAIProviderMetadata>(AI_PROVIDERS.map((provider) => [provider, {
    id: provider,
    name: AI_PROVIDER_NAMES[provider],
    description: AI_PROVIDER_DESCRIPTIONS[provider]
}]));

export const getProviderMetadata = (provider: TeamAIProvider): TeamAIProviderMetadata => {
    const metadata = CATALOG.get(provider);
    if (!metadata) {
        throw new Error(`Unsupported provider: ${provider}`);
    }

    return metadata;
};

export const getAllProviderMetadata = (): TeamAIProviderMetadata[] => Array.from(CATALOG.values());

export const normalizeProvider = (provider: string): TeamAIProvider | null => {
    const normalized = provider.toLowerCase().trim() as TeamAIProvider;

    return CATALOG.has(normalized) ? normalized : null;
};
