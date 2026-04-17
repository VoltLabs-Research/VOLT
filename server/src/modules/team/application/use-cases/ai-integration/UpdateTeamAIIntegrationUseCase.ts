import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { UpdateTeamAIIntegrationInputDTO, UpdateTeamAIIntegrationOutputDTO } from '@modules/team/application/dtos/ai-integration/UpdateTeamAIIntegrationDTO';
import TeamAIIntegrationUpdatedEvent from '@modules/team/domain/events/ai-integration/TeamAIIntegrationUpdatedEvent';
import type { ITeamAIIntegrationSecretCipher } from '@modules/team/domain/port/ai-integration/ITeamAIIntegrationSecretCipher';
import { ITeamAIIntegrationRepository } from '@modules/team/domain/port/ai-integration/ITeamAIIntegrationRepository';
import TeamAIProviderCatalog from '@modules/team/infrastructure/services/ai-integration/TeamAIProviderCatalog';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';
import { toTeamAIIntegrationItemDTO } from './toTeamAIIntegrationItemDTO';

@injectable()
export default class UpdateTeamAIIntegrationUseCase implements IUseCase<UpdateTeamAIIntegrationInputDTO, UpdateTeamAIIntegrationOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamAIIntegrationRepository)
        private readonly integrationRepository: ITeamAIIntegrationRepository,

        @inject(TEAM_TOKENS.TeamAIProviderCatalog)
        private readonly providerCatalog: TeamAIProviderCatalog,

        @inject(TEAM_TOKENS.TeamAIIntegrationSecretCipher)
        private readonly secretCipher: ITeamAIIntegrationSecretCipher,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async execute(input: UpdateTeamAIIntegrationInputDTO): Promise<Result<UpdateTeamAIIntegrationOutputDTO, ApplicationError>> {
        const provider = this.providerCatalog.normalize(input.provider);
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

        const apiKey = input.apiKey?.trim();
        const encryptedApiKey = apiKey
            ? await this.secretCipher.encrypt(apiKey)
            : existing.props.encryptedApiKey || await this.secretCipher.encrypt('ollama-local');

        const defaultModel = input.defaultModel?.trim() || existing.props.defaultModel || null;
        if (!defaultModel) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_AI_INTEGRATION_MODEL_UNSUPPORTED,
                'Default model is required'
            ));
        }

        const metadata = input.metadata ?? existing.props.metadata;
        const enabledModels = input.enabledModels
            ? input.enabledModels
                .map(({ id, name }) => ({ id: id.trim(), name: name.trim() }))
                .filter(({ id, name }) => id.length > 0 && name.length > 0)
            : existing.props.enabledModels || [];

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
            integration: toTeamAIIntegrationItemDTO(persisted, this.providerCatalog)
        });
    }
};
