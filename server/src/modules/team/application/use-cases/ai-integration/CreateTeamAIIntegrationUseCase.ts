import { ErrorCodes } from '@core/constants/error-codes';
import { CreateTeamAIIntegrationInputDTO, CreateTeamAIIntegrationOutputDTO } from '@modules/team/application/dtos/ai-integration/CreateTeamAIIntegrationDTO';
import TeamAIIntegration from '@modules/team/domain/entities/ai-integration/TeamAIIntegration';
import TeamAIIntegrationCreatedEvent from '@modules/team/domain/events/ai-integration/TeamAIIntegrationCreatedEvent';
import TeamAIIntegrationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/ai-integration/TeamAIIntegrationRepository';
import TeamAIIntegrationSecretCipher from '@modules/team/infrastructure/security/ai-integration/TeamAIIntegrationSecretCipher';
import TeamAIProviderCatalog from '@modules/team/infrastructure/services/ai-integration/TeamAIProviderCatalog';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';
import { toTeamAIIntegrationItemDTO } from './toTeamAIIntegrationItemDTO';

@injectable()
export default class CreateTeamAIIntegrationUseCase implements IUseCase<CreateTeamAIIntegrationInputDTO, CreateTeamAIIntegrationOutputDTO, ApplicationError> {
    constructor(
        
        private readonly integrationRepository: TeamAIIntegrationRepository,

        
        private readonly providerCatalog: TeamAIProviderCatalog,

        
        private readonly secretCipher: TeamAIIntegrationSecretCipher,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async execute(input: CreateTeamAIIntegrationInputDTO): Promise<Result<CreateTeamAIIntegrationOutputDTO, ApplicationError>> {
        const provider = this.providerCatalog.normalize(input.provider);
        if (!provider) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_AI_INTEGRATION_PROVIDER_UNSUPPORTED,
                'Provider is not supported'
            ));
        }

        const existing = await this.integrationRepository.findOne({ team: input.teamId, provider });
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

        const defaultModel = input.defaultModel?.trim() || null;
        if (!defaultModel) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_AI_INTEGRATION_MODEL_UNSUPPORTED,
                'Default model is required'
            ));
        }

        const encryptedApiKey = await this.secretCipher.encrypt(providedApiKey || 'ollama-local');
        const metadata = input.metadata;
        const enabledModels = (input.enabledModels ?? [])
            .map(({ id, name }) => ({ id: id.trim(), name: name.trim() }))
            .filter(({ id, name }) => id.length > 0 && name.length > 0);

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

        await this.eventBus.publish(new TeamAIIntegrationCreatedEvent({
            teamAIIntegrationId: persisted._id,
            teamId: persisted.getTeamId(),
            provider: persisted.props.provider,
            isEnabled: persisted.props.isEnabled,
            defaultModel: persisted.props.defaultModel
        }));

        return Result.ok({
            integration: toTeamAIIntegrationItemDTO(persisted, this.providerCatalog)
        });
    }
};
