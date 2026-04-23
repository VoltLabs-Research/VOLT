import { GetTeamAIIntegrationsInputDTO, GetTeamAIIntegrationsOutputDTO } from '@modules/team/application/dtos/ai-integration/GetTeamAIIntegrationsDTO';
import TeamAIIntegrationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/ai-integration/TeamAIIntegrationRepository';
import TeamAIProviderCatalog from '@modules/team/infrastructure/services/ai-integration/TeamAIProviderCatalog';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';
import { toTeamAIIntegrationItemDTO } from './toTeamAIIntegrationItemDTO';

@injectable()
export default class GetTeamAIIntegrationsUseCase implements IUseCase<GetTeamAIIntegrationsInputDTO, GetTeamAIIntegrationsOutputDTO> {
    constructor(
        
        private readonly integrationRepository: TeamAIIntegrationRepository,

        
        private readonly providerCatalog: TeamAIProviderCatalog
    ) {}

    async execute(input: GetTeamAIIntegrationsInputDTO): Promise<Result<GetTeamAIIntegrationsOutputDTO>> {
        const integrations = await this.integrationRepository.listByTeamId(input.teamId);

        return Result.ok({
            teamId: input.teamId,
            integrations: integrations.map((integration) => toTeamAIIntegrationItemDTO(integration, this.providerCatalog)),
            providers: this.providerCatalog.getAllProviderMetadata()
        });
    }
};
