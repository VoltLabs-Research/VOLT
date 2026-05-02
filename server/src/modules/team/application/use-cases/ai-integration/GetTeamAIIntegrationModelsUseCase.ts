import type {
    GetTeamAIIntegrationModelsInputDTO,
    GetTeamAIIntegrationModelsOutputDTO,
    TeamAIModelListItemDTO,
    TeamAIProviderModelsDTO
} from '@modules/team/application/dtos/ai-integration/GetTeamAIIntegrationModelsDTO';
import TeamAIIntegrationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/ai-integration/TeamAIIntegrationRepository';
import TeamAIProviderCatalog from '@modules/team/infrastructure/services/ai-integration/TeamAIProviderCatalog';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class GetTeamAIIntegrationModelsUseCase implements IUseCase<GetTeamAIIntegrationModelsInputDTO, GetTeamAIIntegrationModelsOutputDTO> {
    constructor(
        private readonly integrationRepository: TeamAIIntegrationRepository,
        private readonly providerCatalog: TeamAIProviderCatalog
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
