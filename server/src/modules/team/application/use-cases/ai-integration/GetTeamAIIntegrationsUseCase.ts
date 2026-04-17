import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { GetTeamAIIntegrationsInputDTO, GetTeamAIIntegrationsOutputDTO } from '@modules/team/application/dtos/ai-integration/GetTeamAIIntegrationsDTO';
import TeamAIProviderCatalog from '@modules/team/infrastructure/services/ai-integration/TeamAIProviderCatalog';
import { ITeamAIIntegrationRepository } from '@modules/team/domain/port/ai-integration/ITeamAIIntegrationRepository';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';
import { toTeamAIIntegrationItemDTO } from './toTeamAIIntegrationItemDTO';

@injectable()
export default class GetTeamAIIntegrationsUseCase implements IUseCase<GetTeamAIIntegrationsInputDTO, GetTeamAIIntegrationsOutputDTO> {
    constructor(
        @inject(TEAM_TOKENS.TeamAIIntegrationRepository)
        private readonly integrationRepository: ITeamAIIntegrationRepository,

        @inject(TEAM_TOKENS.TeamAIProviderCatalog)
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
