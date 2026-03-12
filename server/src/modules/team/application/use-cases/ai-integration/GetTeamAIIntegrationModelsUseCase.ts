import { ErrorCodes } from '@core/constants/error-codes';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { GetTeamAIIntegrationModelsInputDTO, GetTeamAIIntegrationModelsOutputDTO, TeamAIModelListItemDTO, TeamAIProviderModelsDTO } from '@modules/team/application/dtos/ai-integration/GetTeamAIIntegrationModelsDTO';
import TeamAIIntegrationSecretService from '@modules/team/infrastructure/services/ai-integration/TeamAIIntegrationSecretService';
import TeamAIProviderCatalog from '@modules/team/infrastructure/services/ai-integration/TeamAIProviderCatalog';
import { ITeamAIIntegrationRepository } from '@modules/team/domain/port/ai-integration/ITeamAIIntegrationRepository';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';
import type { IAIProviderModelDiscovery } from '@modules/ai/domain/port/IAIProviderModelDiscovery';

@injectable()
export default class GetTeamAIIntegrationModelsUseCase implements IUseCase<GetTeamAIIntegrationModelsInputDTO, GetTeamAIIntegrationModelsOutputDTO> {
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

    async execute(input: GetTeamAIIntegrationModelsInputDTO): Promise<Result<GetTeamAIIntegrationModelsOutputDTO>> {
        const integrations = await this.integrationRepository.listEnabledByTeamIdWithSecrets(input.teamId);

        const providers: TeamAIProviderModelsDTO[] = [];
        const models: TeamAIModelListItemDTO[] = [];

        const discoveryResults = await Promise.all(
            integrations.map(async (integration) => {
                const apiKey = this.secretService.decryptApiKey(integration.props.encryptedApiKey);
                if (!apiKey && integration.props.provider !== 'ollama') {
                    return null;
                }

                const metadata = integration.props.provider === 'ollama'
                    ? {
                        ...(integration.props.metadata || {}),
                        baseUrl: this.resolveOllamaBaseUrl(integration.props.metadata)
                    }
                    : integration.props.metadata;

                const discovered = await this.discoveryService.fetchModels(
                    integration.props.provider,
                    apiKey,
                    metadata
                );

                return {
                    integration,
                    metadata,
                    discovered
                };
            })
        );

        for (const result of discoveryResults) {
            if (!result) continue;

            const { integration, metadata, discovered } = result;
            const providerMeta = this.providerCatalog.getProviderMetadata(integration.props.provider);
            const enabledSet = integration.props.enabledModels?.length
                ? new Set(integration.props.enabledModels.map((id) => this.stripProviderPrefix(id)))
                : null;

            const providerModels = discovered
                .filter((m) => !enabledSet || enabledSet.has(m.id))
                .map((m) => ({
                    id: m.id,
                    name: m.name,
                    description: m.description
                }));

            const strippedDefaultModel = integration.props.defaultModel
                ? this.stripProviderPrefix(integration.props.defaultModel)
                : undefined;

            providers.push({
                provider: integration.props.provider,
                providerName: providerMeta.name,
                defaultModel: strippedDefaultModel,
                metadata,
                models: providerModels
            });

            providerModels.forEach((model) => {
                models.push({
                    ...model,
                    provider: integration.props.provider,
                    providerName: providerMeta.name,
                    isDefault: strippedDefaultModel === model.id
                });
            });
        }

        return Result.ok({
            teamId: input.teamId,
            providers,
            models
        });
    }

    /**
     * Strips the provider prefix from a model ID for backward compatibility.
     * Old integrations may store OpenRouter-prefixed IDs (e.g. `x-ai/grok-4.1-fast`)
     * while the discovery service now returns stripped IDs (e.g. `grok-4.1-fast`).
     * Non-prefixed IDs (e.g. Ollama models) are returned unchanged.
     */
    private stripProviderPrefix(modelId: string): string {
        const slashIndex = modelId.indexOf('/');
        return slashIndex !== -1 ? modelId.slice(slashIndex + 1) : modelId;
    }

    private resolveOllamaBaseUrl(metadata?: Record<string, unknown>): string {
        const baseUrl = typeof metadata?.baseUrl === 'string' ? metadata.baseUrl.trim() : '';
        if (!baseUrl) {
            throw ApplicationError.badRequest(
                ErrorCodes.AI_INTEGRATION_NOT_CONFIGURED,
                'Ollama baseUrl is required'
            );
        }

        return baseUrl;
    }
};
