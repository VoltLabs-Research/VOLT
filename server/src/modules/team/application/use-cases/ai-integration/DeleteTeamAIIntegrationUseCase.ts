import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { DeleteTeamAIIntegrationInputDTO } from '@modules/team/application/dtos/ai-integration/DeleteTeamAIIntegrationDTO';
import TeamAIIntegrationInputService from '@modules/team/infrastructure/services/ai-integration/TeamAIIntegrationInputService';
import TeamAIIntegrationDeletedEvent from '@modules/team/domain/events/ai-integration/TeamAIIntegrationDeletedEvent';
import { ITeamAIIntegrationRepository } from '@modules/team/domain/port/ai-integration/ITeamAIIntegrationRepository';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';

@injectable()
export default class DeleteTeamAIIntegrationUseCase implements IUseCase<DeleteTeamAIIntegrationInputDTO, null, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamAIIntegrationRepository)
        private readonly integrationRepository: ITeamAIIntegrationRepository,

        @inject(TEAM_TOKENS.TeamAIIntegrationInputService)
        private readonly inputService: TeamAIIntegrationInputService,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
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

        await this.eventBus.publish(new TeamAIIntegrationDeletedEvent({
            teamAIIntegrationId: integration._id,
            teamId: integration.getTeamId(),
            provider: integration.props.provider
        }));

        return Result.ok(null);
    }
};
