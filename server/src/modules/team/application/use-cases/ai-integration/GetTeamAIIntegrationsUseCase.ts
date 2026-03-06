import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ITeamAIIntegrationRepository } from '@modules/team/domain/port/ITeamAIIntegrationRepository';
import {
    GetTeamAIIntegrationsInputDTO,
    GetTeamAIIntegrationsOutputDTO
} from '@modules/team/application/dtos/ai-integration/GetTeamAIIntegrationsDTO';
import TeamAIIntegrationSerializer from '@modules/team/application/services/TeamAIIntegrationSerializer';

@injectable()
export default class GetTeamAIIntegrationsUseCase implements IUseCase<GetTeamAIIntegrationsInputDTO, GetTeamAIIntegrationsOutputDTO> {
    constructor(
        @inject(TEAM_TOKENS.TeamAIIntegrationRepository)
        private readonly integrationRepository: ITeamAIIntegrationRepository,

        @inject(TEAM_TOKENS.TeamAIIntegrationSerializer)
        private readonly integrationSerializer: TeamAIIntegrationSerializer
    ) {}

    async execute(input: GetTeamAIIntegrationsInputDTO): Promise<Result<GetTeamAIIntegrationsOutputDTO>> {
        const integrations = await this.integrationRepository.listByTeamId(input.teamId);

        return Result.ok({
            teamId: input.teamId,
            integrations: integrations.map((i) => this.integrationSerializer.toDTO(i))
        });
    }
}
