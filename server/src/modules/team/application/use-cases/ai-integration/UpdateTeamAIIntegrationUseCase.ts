import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import TeamAIIntegration from '@modules/team/domain/entities/TeamAIIntegration';
import { ITeamAIIntegrationRepository } from '@modules/team/domain/ports/ITeamAIIntegrationRepository';
import TeamAIIntegrationInputService from '@modules/team/application/services/TeamAIIntegrationInputService';
import {
    UpdateTeamAIIntegrationInputDTO,
    UpdateTeamAIIntegrationOutputDTO
} from '@modules/team/application/dtos/ai-integration/UpdateTeamAIIntegrationDTO';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import TeamAIIntegrationUpdatedEvent from '@modules/team/domain/events/TeamAIIntegrationUpdatedEvent';
import TeamAIIntegrationSerializer from '@modules/team/application/services/TeamAIIntegrationSerializer';

@injectable()
export default class UpdateTeamAIIntegrationUseCase implements IUseCase<UpdateTeamAIIntegrationInputDTO, UpdateTeamAIIntegrationOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamAIIntegrationRepository)
        private readonly integrationRepository: ITeamAIIntegrationRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,

        @inject(TEAM_TOKENS.TeamAIIntegrationInputService)
        private readonly inputService: TeamAIIntegrationInputService,

        @inject(TEAM_TOKENS.TeamAIIntegrationSerializer)
        private readonly integrationSerializer: TeamAIIntegrationSerializer
    ) {}

    async execute(input: UpdateTeamAIIntegrationInputDTO): Promise<Result<UpdateTeamAIIntegrationOutputDTO, ApplicationError>> {
        const provider = this.inputService.normalizeProvider(input.provider);
        if (!provider) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_AI_INTEGRATION_PROVIDER_UNSUPPORTED,
                'Provider is not supported'
            ));
        }

        const existing = await this.integrationRepository.findByTeamAndProviderWithSecret(input.teamId, provider);
        if (!existing) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_AI_INTEGRATION_NOT_FOUND,
                'AI integration not found for this provider'
            ));
        }

        const providedApiKey = input.apiKey?.trim();
        const encryptedApiKey = providedApiKey
            ? TeamAIIntegration.encryptApiKey(providedApiKey)
            : existing.props.encryptedApiKey;

        const defaultModel = this.inputService.resolveDefaultModel(
            input.defaultModel,
            existing.props.defaultModel
        );
        if (!defaultModel) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_AI_INTEGRATION_MODEL_UNSUPPORTED,
                'Default model is required'
            ));
        }

        const metadata = this.inputService.resolveMetadata(input.metadata, existing.props.metadata);
        const enabledModels = this.inputService.normalizeEnabledModels(
            input.enabledModels,
            existing.props.enabledModels || []
        );

        const now = new Date();
        const persisted = await this.integrationRepository.updateById(existing.id, {
            encryptedApiKey,
            isEnabled: input.isEnabled ?? existing.props.isEnabled,
            defaultModel,
            enabledModels,
            metadata,
            updatedAt: now
        });

        if (!persisted) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_AI_INTEGRATION_NOT_FOUND,
                'AI integration could not be updated'
            ));
        }

        await this.eventBus.publish(new TeamAIIntegrationUpdatedEvent({
            teamAIIntegrationId: persisted.id,
            teamId: input.teamId,
            provider,
            isEnabled: persisted.props.isEnabled,
            defaultModel: persisted.props.defaultModel
        }));

        return Result.ok({
            integration: this.integrationSerializer.toDTO(persisted)
        });
    }
}
