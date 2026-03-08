import { injectable, inject } from 'tsyringe';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/application/di/TeamTokens';
import TeamAIIntegration from '@modules/team/domain/entities/TeamAIIntegration';
import { ITeamAIIntegrationRepository } from '@modules/team/domain/port/ITeamAIIntegrationRepository';
import TeamAIIntegrationInputService from '@modules/team/application/services/TeamAIIntegrationInputService';
import TeamAIIntegrationSecretService from '@modules/team/application/services/TeamAIIntegrationSecretService';
import {
    CreateTeamAIIntegrationInputDTO,
    CreateTeamAIIntegrationOutputDTO
} from '@modules/team/application/dtos/ai-integration/CreateTeamAIIntegrationDTO';
import TeamAIIntegrationSerializer from '@modules/team/application/services/TeamAIIntegrationSerializer';
import { SHARED_TOKENS } from '@shared/application/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import TeamAIIntegrationCreatedEvent from '@modules/team/domain/events/TeamAIIntegrationCreatedEvent';
import { IUseCase } from '@shared/application/IUseCase';

@injectable()
export default class CreateTeamAIIntegrationUseCase implements IUseCase<CreateTeamAIIntegrationInputDTO, CreateTeamAIIntegrationOutputDTO, ApplicationError> {
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

    async execute(input: CreateTeamAIIntegrationInputDTO): Promise<Result<CreateTeamAIIntegrationOutputDTO, ApplicationError>> {
        const provider = this.inputService.normalizeProvider(input.provider);
        if (!provider) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_AI_INTEGRATION_PROVIDER_UNSUPPORTED,
                'Provider is not supported'
            ));
        }

        const existing = await this.integrationRepository.findByTeamAndProvider(input.teamId, provider);
        if (existing) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_AI_INTEGRATION_ALREADY_EXISTS,
                'An integration for this provider already exists in this team'
            ));
        }

        const requiresApiKey = provider !== 'ollama';
        const providedApiKey = input.apiKey?.trim();

        if (requiresApiKey && !providedApiKey) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_AI_INTEGRATION_API_KEY_REQUIRED,
                'API key is required for new integration'
            ));
        }

        const defaultModel = this.inputService.resolveDefaultModel(input.defaultModel);
        if (!defaultModel) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_AI_INTEGRATION_MODEL_UNSUPPORTED,
                'Default model is required'
            ));
        }

        const encryptedApiKey = this.secretService.resolveEncryptedApiKey(providedApiKey);

        const metadata = this.inputService.resolveMetadata(input.metadata);
        const enabledModels = this.inputService.normalizeEnabledModels(input.enabledModels);

        const persisted = await this.integrationRepository.create(TeamAIIntegration.create({
            teamId: input.teamId,
            provider,
            encryptedApiKey,
            isEnabled: input.isEnabled ?? true,
            defaultModel,
            enabledModels,
            metadata,
            userId: input.userId
        }));

        if (!persisted) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_AI_INTEGRATION_NOT_FOUND,
                'AI integration could not be persisted'
            ));
        }

        await this.eventBus.publish(new TeamAIIntegrationCreatedEvent({
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
}
