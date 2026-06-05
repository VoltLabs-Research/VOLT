import type TeamAIIntegrationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/ai-integration/TeamAIIntegrationRepository';
import type {
    GetTeamAIIntegrationModelsInputDTO,
    GetTeamAIIntegrationModelsOutputDTO,
    TeamAIModelListItemDTO,
    TeamAIProviderModelsDTO
} from '@modules/team/application/dtos/ai-integration/GetTeamAIIntegrationModelsDTO';
import type { ITeamAIProviderCatalog } from '@modules/team/domain/port/ai-integration/ITeamAIProviderCatalog';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class GetTeamAIIntegrationModelsUseCase implements IUseCase<GetTeamAIIntegrationModelsInputDTO, GetTeamAIIntegrationModelsOutputDTO> {
    constructor(
        @inject(TEAM_TOKENS.TeamAIIntegrationRepository) private readonly integrationRepository: TeamAIIntegrationRepository,
        @inject(TEAM_TOKENS.TeamAIProviderCatalog)
        private readonly providerCatalog: ITeamAIProviderCatalog
    ) {}

    async execute(input: GetTeamAIIntegrationModelsInputDTO): Promise<Result<GetTeamAIIntegrationModelsOutputDTO>> {
        const integrations = await this.integrationRepository.listEnabledByTeamIdWithSecrets(input.teamId);

        const providers: TeamAIProviderModelsDTO[] = [];
        const models: TeamAIModelListItemDTO[] = [];

        for (const integration of integrations) {
            const providerMeta = this.providerCatalog.getProviderMetadata(integration.props.provider);
            const enabledModels = integration.props.enabledModels ?? [];

            const providerModels = enabledModels.map((m) => ({
                id: m.id,
                name: m.name
            }));

            providers.push({
                provider: integration.props.provider,
                providerName: providerMeta.name,
                defaultModel: integration.props.defaultModel,
                metadata: integration.props.metadata,
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
}
