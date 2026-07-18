import type { ITeamAIIntegrationRepository } from '@modules/team/ports/ai-integration/ITeamAIIntegrationRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import type { ProviderScopedInputDTO } from '@modules/team/dtos/common';
import type { ITeamAIProviderCatalog } from '@modules/team/ports/ai-integration/ITeamAIProviderCatalog';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class DeleteTeamAIIntegrationUseCase implements IUseCase<ProviderScopedInputDTO, null> {
    constructor(
        @inject(TEAM_TOKENS.TeamAIIntegrationRepository) private readonly integrationRepository: ITeamAIIntegrationRepository,
        @inject(TEAM_TOKENS.TeamAIProviderCatalog)
        private readonly providerCatalog: ITeamAIProviderCatalog
    ) {}

    async execute(input: ProviderScopedInputDTO): Promise<null> {
        const provider = this.providerCatalog.normalize(input.provider);
        if (!provider) {
            throw ApplicationError.badRequest(
                ErrorCodes.TEAM_AI_INTEGRATION_PROVIDER_UNSUPPORTED,
                'Provider is not supported'
            );
        }

        const integration = await this.integrationRepository.findOne({ team: input.teamId, provider });

        if (!integration) {
            throw ApplicationError.notFound(
                ErrorCodes.TEAM_AI_INTEGRATION_NOT_FOUND,
                'Team AI integration not found'
            );
        }

        await this.integrationRepository.deleteByTeamAndProvider(input.teamId, provider);

        return null;
    }
}
