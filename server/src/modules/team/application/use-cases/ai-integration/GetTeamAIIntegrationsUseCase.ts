import type TeamAIIntegrationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/ai-integration/TeamAIIntegrationRepository';
import { GetTeamAIIntegrationsInputDTO, GetTeamAIIntegrationsOutputDTO } from '@modules/team/application/dtos/ai-integration/GetTeamAIIntegrationsDTO';
import type { ITeamAIProviderCatalog } from '@modules/team/domain/port/ai-integration/ITeamAIProviderCatalog';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import { toTeamAIIntegrationItemDTO } from './toTeamAIIntegrationItemDTO';

@injectable()
export default class GetTeamAIIntegrationsUseCase implements IUseCase<GetTeamAIIntegrationsInputDTO, GetTeamAIIntegrationsOutputDTO> {
    constructor(
        @inject(TEAM_TOKENS.TeamAIIntegrationRepository) private readonly integrationRepository: TeamAIIntegrationRepository,
        @inject(TEAM_TOKENS.TeamAIProviderCatalog)
        private readonly providerCatalog: ITeamAIProviderCatalog
    ) {}

    async execute(input: GetTeamAIIntegrationsInputDTO): Promise<Result<GetTeamAIIntegrationsOutputDTO>> {
        const integrations = await this.integrationRepository.listByTeamId(input.teamId);

        return Result.ok({
            teamId: input.teamId,
            integrations: integrations.map((integration) => toTeamAIIntegrationItemDTO(integration, this.providerCatalog)),
            providers: this.providerCatalog.getAllProviderMetadata()
        });
    }
}
