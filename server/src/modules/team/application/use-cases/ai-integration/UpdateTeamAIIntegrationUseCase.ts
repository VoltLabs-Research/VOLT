import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { UpdateTeamAIIntegrationInputDTO, UpdateTeamAIIntegrationOutputDTO } from '@modules/team/application/dtos/ai-integration/UpdateTeamAIIntegrationDTO';
import TeamAIIntegrationInputService from '@modules/team/application/services/ai-integration/TeamAIIntegrationInputService';
import TeamAIIntegrationSecretService from '@modules/team/application/services/ai-integration/TeamAIIntegrationSecretService';
import TeamAIIntegrationSerializer from '@modules/team/application/services/ai-integration/TeamAIIntegrationSerializer';
import TeamAIIntegration from '@modules/team/domain/entities/ai-integration/TeamAIIntegration';
import TeamAIIntegrationUpdatedEvent from '@modules/team/domain/events/ai-integration/TeamAIIntegrationUpdatedEvent';
import { ITeamAIIntegrationRepository } from '@modules/team/domain/port/ai-integration/ITeamAIIntegrationRepository';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';

@injectable()
export default class UpdateTeamAIIntegrationUseCase implements IUseCase<UpdateTeamAIIntegrationInputDTO, UpdateTeamAIIntegrationOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamAIIntegrationRepository)
        private readonly integrationRepository: ITeamAIIntegrationRepository,

        @inject(TEAM_TOKENS.TeamAIIntegrationInputService)
        private readonly inputService: TeamAIIntegrationInputService,

        @inject(TEAM_TOKENS.TeamAIIntegrationSecretService)
        private readonly secretService: TeamAIIntegrationSecretService,

        @inject(TEAM_TOKENS.TeamAIIntegrationSerializer)
        private readonly integrationSerializer: TeamAIIntegrationSerializer,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
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

        const encryptedApiKey = this.secretService.resolveEncryptedApiKey(
            input.apiKey,
            existing.props.encryptedApiKey
        );

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

        const persisted = await this.integrationRepository.updateById(existing._id, existing.buildUpdatePayload({
            encryptedApiKey,
            isEnabled: input.isEnabled ?? existing.props.isEnabled,
            defaultModel,
            enabledModels,
            metadata
        }));

        if (!persisted) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_AI_INTEGRATION_NOT_FOUND,
                'AI integration could not be updated'
            ));
        }

        await this.eventBus.publish(new TeamAIIntegrationUpdatedEvent({
            teamAIIntegrationId: persisted._id,
            teamId: persisted.getTeamId(),
            provider: persisted.props.provider,
            isEnabled: persisted.props.isEnabled,
            defaultModel: persisted.props.defaultModel
        }));

        return Result.ok({
            integration: this.integrationSerializer.toDTO(persisted)
        });
    }
};
