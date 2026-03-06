import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ITeamAIIntegrationRepository } from '@modules/team/domain/port/ITeamAIIntegrationRepository';
import TeamAIIntegrationInputService from '@modules/team/application/services/TeamAIIntegrationInputService';
import { DeleteTeamAIIntegrationInputDTO } from '@modules/team/application/dtos/ai-integration/DeleteTeamAIIntegrationDTO';
@injectable()
export default class DeleteTeamAIIntegrationUseCase implements IUseCase<DeleteTeamAIIntegrationInputDTO, null, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamAIIntegrationRepository)
        private readonly integrationRepository: ITeamAIIntegrationRepository,

        @inject(TEAM_TOKENS.TeamAIIntegrationInputService)
        private readonly inputService: TeamAIIntegrationInputService
    ) {}

    async execute(input: DeleteTeamAIIntegrationInputDTO): Promise<Result<null, ApplicationError>> {
        const provider = this.inputService.normalizeProvider(input.provider);
        if (!provider) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_AI_INTEGRATION_PROVIDER_UNSUPPORTED,
                'Provider is not supported'
            ));
        }

        const integration = await this.integrationRepository.findByTeamAndProvider(input.teamId, provider);

        if (!integration) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_AI_INTEGRATION_NOT_FOUND,
                'Team AI integration not found'
            ));
        }

        await this.integrationRepository.deleteByTeamAndProvider(input.teamId, provider);

        return Result.ok(null);
    }
}
