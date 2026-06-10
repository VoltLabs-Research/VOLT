import type TeamAIIntegrationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/ai-integration/TeamAIIntegrationRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import { UpdateTeamAIIntegrationInputDTO, UpdateTeamAIIntegrationOutputDTO } from '@modules/team/application/dtos/ai-integration/UpdateTeamAIIntegrationDTO';
import type { ITeamAIProviderCatalog } from '@modules/team/domain/port/ai-integration/ITeamAIProviderCatalog';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import TeamAIIntegrationSecretCipher from '@modules/team/infrastructure/security/ai-integration/TeamAIIntegrationSecretCipher';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import { toTeamAIIntegrationItemDTO } from './toTeamAIIntegrationItemDTO';

@injectable()
export default class UpdateTeamAIIntegrationUseCase implements IUseCase<UpdateTeamAIIntegrationInputDTO, UpdateTeamAIIntegrationOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamAIIntegrationRepository) private readonly integrationRepository: TeamAIIntegrationRepository,
        @inject(TEAM_TOKENS.TeamAIProviderCatalog)
        private readonly providerCatalog: ITeamAIProviderCatalog,
        private readonly secretCipher: TeamAIIntegrationSecretCipher
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

        return Result.ok({
            integration: toTeamAIIntegrationItemDTO(persisted, this.providerCatalog)
        });
    }
}
