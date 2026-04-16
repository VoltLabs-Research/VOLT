import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import TeamAIProviderCatalog from '@modules/team/infrastructure/services/ai-integration/TeamAIProviderCatalog';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import { inject, injectable } from 'tsyringe';
import type { EnabledModel, TeamAIProvider } from '@modules/team/domain/entities/ai-integration/TeamAIIntegration';

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

    /**
     * Normalizes and deduplicates enabled models.
     * Handles backward compatibility: plain string entries (old format)
     * are converted to `{ id, name }` where name defaults to the id.
     */
    normalizeEnabledModels(enabledModels: unknown, fallback: EnabledModel[] = []): EnabledModel[] {
        if (!Array.isArray(enabledModels)) {
            return fallback;
        }

        const normalized: EnabledModel[] = [];

        for (const entry of enabledModels) {
            if (typeof entry === 'string') {
                const id = entry.trim();
                if (id.length > 0) {
                    normalized.push({ id, name: id });
                }
                continue;
            }

            if (isRecord(entry) && typeof entry.id === 'string' && typeof entry.name === 'string') {
                const id = entry.id.trim();
                const name = entry.name.trim();
                if (id.length > 0 && name.length > 0) {
                    normalized.push({ id, name });
                }
            }
        }

        return [...new Map(normalized.map((m) => [m.id, m])).values()];
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
};
