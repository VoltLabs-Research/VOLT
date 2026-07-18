import type { ITeamAIIntegrationRepository } from '@modules/team/ports/ai-integration/ITeamAIIntegrationRepository';
import { GetTeamAIIntegrationsInputDTO, GetTeamAIIntegrationsOutputDTO } from '@modules/team/dtos/ai-integration/GetTeamAIIntegrationsDTO';
import type { ITeamAIProviderCatalog } from '@modules/team/ports/ai-integration/ITeamAIProviderCatalog';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';
import { toTeamAIIntegrationItemDTO } from './toTeamAIIntegrationItemDTO';

@injectable()
export default class GetTeamAIIntegrationsUseCase implements IUseCase<GetTeamAIIntegrationsInputDTO, GetTeamAIIntegrationsOutputDTO> {
    constructor(
        @inject(TEAM_TOKENS.TeamAIIntegrationRepository) private readonly integrationRepository: ITeamAIIntegrationRepository,
        @inject(TEAM_TOKENS.TeamAIProviderCatalog)
        private readonly providerCatalog: ITeamAIProviderCatalog
    ) {}

    async execute(input: GetTeamAIIntegrationsInputDTO): Promise<GetTeamAIIntegrationsOutputDTO> {
        const integrations = await this.integrationRepository.listByTeamId(input.teamId);

        return {
            teamId: input.teamId,
            integrations: integrations.map((integration) => toTeamAIIntegrationItemDTO(integration, this.providerCatalog)),
            providers: this.providerCatalog.getAllProviderMetadata()
        };
    }
}
