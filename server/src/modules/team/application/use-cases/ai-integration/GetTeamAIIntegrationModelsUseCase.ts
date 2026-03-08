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
                ? new Set(integration.props.enabledModels)
                : null;

            const providerModels = discovered
                .filter((m) => !enabledSet || enabledSet.has(m.id))
                .map((m) => ({
                    id: m.id,
                    name: m.name,
                    description: m.description
                }));

            providers.push({
                provider: integration.props.provider,
                providerName: providerMeta.name,
                defaultModel: integration.props.defaultModel,
                metadata,
                models: providerModels
            });

            providerModels.forEach((model) => {
                models.push({
                    ...model,
                    provider: integration.props.provider,
                    providerName: providerMeta.name,
                    isDefault: integration.props.defaultModel === model.id
                });
            });
        }

        return Result.ok({
            teamId: input.teamId,
            providers,
            models
        });
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
