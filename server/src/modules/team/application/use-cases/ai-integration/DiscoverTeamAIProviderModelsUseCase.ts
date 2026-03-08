import { ErrorCodes } from '@core/constants/error-codes';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { getAIProviderCatalogModels } from '@modules/ai/domain/contracts/AIProviderModels';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import TeamAIIntegrationSecretService from '@modules/team/application/services/ai-integration/TeamAIIntegrationSecretService';
import TeamAIProviderCatalog from '@modules/team/application/services/ai-integration/TeamAIProviderCatalog';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';
import type { IAIProviderModelDiscovery } from '@modules/ai/domain/port/IAIProviderModelDiscovery';
import type { DiscoverTeamAIProviderModelsInputDTO, DiscoverTeamAIProviderModelsOutputDTO } from '@modules/team/application/dtos/ai-integration/DiscoverTeamAIProviderModelsDTO';
import type { ITeamAIIntegrationRepository } from '@modules/team/domain/port/ai-integration/ITeamAIIntegrationRepository';

interface AIProviderModelIdentifier {
    id: string;
};

@injectable()
export default class DiscoverTeamAIProviderModelsUseCase implements IUseCase<DiscoverTeamAIProviderModelsInputDTO, DiscoverTeamAIProviderModelsOutputDTO> {
    constructor(
        @inject(TEAM_TOKENS.TeamAIIntegrationRepository)
        private readonly integrationRepository: ITeamAIIntegrationRepository,

        @inject(AI_TOKENS.AIProviderModelDiscovery)
        private readonly discoveryService: IAIProviderModelDiscovery,

        @inject(TEAM_TOKENS.TeamAIIntegrationSecretService)
        private readonly secretService: TeamAIIntegrationSecretService,

        @inject(TEAM_TOKENS.TeamAIProviderCatalog)
        private readonly providerCatalog: TeamAIProviderCatalog
    ) {}

    async execute(input: DiscoverTeamAIProviderModelsInputDTO): Promise<Result<DiscoverTeamAIProviderModelsOutputDTO>> {
        const existing = await this.integrationRepository.findByTeamAndProviderWithSecret(input.teamId, input.provider);
        const providerMeta = this.providerCatalog.getProviderMetadata(input.provider);
        const fallbackModels = getAIProviderCatalogModels(input.provider);

        const apiKey = input.apiKey?.trim()
            || this.secretService.decryptApiKey(existing?.props.encryptedApiKey)
            || '';
        if (!apiKey && input.provider !== 'ollama') {
            return Result.ok({
                teamId: input.teamId,
                provider: input.provider,
                providerName: providerMeta.name,
                defaultModel: this.resolveDefaultModel(existing?.props.defaultModel, fallbackModels),
                metadata: input.metadata ?? existing?.props.metadata,
                models: fallbackModels
            });
        }

        const metadata = input.provider === 'ollama'
            ? {
                ...(existing?.props.metadata || {}),
                ...(input.metadata || {})
            }
            : input.metadata ?? existing?.props.metadata;

        if (input.provider === 'ollama') {
            const baseUrl = typeof metadata?.baseUrl === 'string' ? metadata.baseUrl.trim() : '';
            if (!baseUrl) {
                throw ApplicationError.badRequest(
                    ErrorCodes.AI_INTEGRATION_NOT_CONFIGURED,
                    'Ollama baseUrl is required'
                );
            }
        }

        const discovered = await this.discoveryService.fetchModels(input.provider, apiKey, metadata);
        const discoveredModels = discovered.map((model) => ({
            id: model.id,
            name: model.name,
            description: model.description
        }));
        const models = discoveredModels.length > 0 || input.provider === 'ollama'
            ? discoveredModels
            : fallbackModels;
        const defaultModel = this.resolveDefaultModel(existing?.props.defaultModel, models);

        return Result.ok({
            teamId: input.teamId,
            provider: input.provider,
            providerName: providerMeta.name,
            defaultModel,
            metadata,
            models
        });
    }

    private resolveDefaultModel(
        existingDefault: string | undefined,
        models: AIProviderModelIdentifier[]
    ): string | null {
        if (existingDefault && models.some((model) => model.id === existingDefault)) {
            return existingDefault;
        }

        return models[0]?.id || null;
    }
};
