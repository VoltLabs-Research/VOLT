import { ErrorCodes } from '@core/constants/error-codes';
import type { ProviderScopedInputDTO } from '@modules/team/application/dtos/common';
import TeamAIIntegrationDeletedEvent from '@modules/team/domain/events/ai-integration/TeamAIIntegrationDeletedEvent';
import TeamAIIntegrationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/ai-integration/TeamAIIntegrationRepository';
import TeamAIProviderCatalog from '@modules/team/infrastructure/services/ai-integration/TeamAIProviderCatalog';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class DeleteTeamAIIntegrationUseCase implements IUseCase<ProviderScopedInputDTO, null, ApplicationError> {
    constructor(
        private readonly integrationRepository: TeamAIIntegrationRepository,
        private readonly providerCatalog: TeamAIProviderCatalog,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async execute(input: ProviderScopedInputDTO): Promise<Result<null, ApplicationError>> {
        const provider = this.providerCatalog.normalize(input.provider);
        if (!provider) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_AI_INTEGRATION_PROVIDER_UNSUPPORTED,
                'Provider is not supported'
            ));
        }

        const integration = await this.integrationRepository.findOne({ team: input.teamId, provider });

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
}
