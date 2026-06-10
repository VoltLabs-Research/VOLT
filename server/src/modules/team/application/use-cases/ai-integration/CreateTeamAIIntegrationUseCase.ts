import type TeamAIIntegrationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/ai-integration/TeamAIIntegrationRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import { CreateTeamAIIntegrationInputDTO, CreateTeamAIIntegrationOutputDTO } from '@modules/team/application/dtos/ai-integration/CreateTeamAIIntegrationDTO';
import TeamAIIntegration from '@modules/team/domain/entities/ai-integration/TeamAIIntegration';
import type { ITeamAIProviderCatalog } from '@modules/team/domain/port/ai-integration/ITeamAIProviderCatalog';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import TeamAIIntegrationSecretCipher from '@modules/team/infrastructure/security/ai-integration/TeamAIIntegrationSecretCipher';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import { toTeamAIIntegrationItemDTO } from './toTeamAIIntegrationItemDTO';

@injectable()
export default class CreateTeamAIIntegrationUseCase implements IUseCase<CreateTeamAIIntegrationInputDTO, CreateTeamAIIntegrationOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamAIIntegrationRepository) private readonly integrationRepository: TeamAIIntegrationRepository,
        @inject(TEAM_TOKENS.TeamAIProviderCatalog)
        private readonly providerCatalog: ITeamAIProviderCatalog,
        private readonly secretCipher: TeamAIIntegrationSecretCipher
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

        return Result.ok({
            integration: toTeamAIIntegrationItemDTO(persisted, this.providerCatalog)
        });
    }
}
