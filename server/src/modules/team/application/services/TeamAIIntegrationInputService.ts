import { inject, injectable } from 'tsyringe';
import type { TeamAIProvider } from '@modules/team/domain/entities/TeamAIIntegration';
import TeamAIProviderCatalog from '@modules/team/application/services/TeamAIProviderCatalog';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';

const isRecord = (value: unknown): value is Record<string, unknown> => {
    if (value === null || typeof value !== 'object') {
        return false;
    }

    return !Array.isArray(value);
};

@injectable()
export default class TeamAIIntegrationInputService {
    constructor(
        @inject(TEAM_TOKENS.TeamAIProviderCatalog)
        private readonly providerCatalog: TeamAIProviderCatalog
    ) {}

    normalizeProvider(provider: string): TeamAIProvider | null {
        return this.providerCatalog.normalize(provider);
    }

    resolveDefaultModel(defaultModel?: string, fallbackDefaultModel?: string): string | null {
        const resolved = defaultModel?.trim() || fallbackDefaultModel?.trim() || '';
        return resolved || null;
    }

    normalizeEnabledModels(enabledModels: unknown, fallback: string[] = []): string[] {
        if (!Array.isArray(enabledModels)) {
            return fallback;
        }

        const normalized = enabledModels
            .filter((model): model is string => typeof model === 'string')
            .map((model) => model.trim())
            .filter((model) => model.length > 0);

        return [...new Set(normalized)];
    }

    resolveMetadata(
        metadata: unknown,
        fallback?: Record<string, unknown>
    ): Record<string, unknown> | undefined {
        if (isRecord(metadata)) {
            return metadata;
        }

        return fallback;
    }
}
