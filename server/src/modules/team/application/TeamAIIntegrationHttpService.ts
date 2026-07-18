import CreateTeamAIIntegrationUseCase from '@modules/team/application/use-cases/ai-integration/CreateTeamAIIntegrationUseCase';
import DeleteTeamAIIntegrationUseCase from '@modules/team/application/use-cases/ai-integration/DeleteTeamAIIntegrationUseCase';
import GetTeamAIIntegrationModelsUseCase from '@modules/team/application/use-cases/ai-integration/GetTeamAIIntegrationModelsUseCase';
import GetTeamAIIntegrationsUseCase from '@modules/team/application/use-cases/ai-integration/GetTeamAIIntegrationsUseCase';
import UpdateTeamAIIntegrationUseCase from '@modules/team/application/use-cases/ai-integration/UpdateTeamAIIntegrationUseCase';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { UseCaseInput, UseCaseOutput } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

/**
 * The HTTP-facing application service for the team ai-integration resource.
 * Thin delegators to retained use cases, returning each use case's value and letting a thrown
 * `ApplicationError` reach the global `httpErrorMiddleware`. See {@link TeamHttpService} for the shared rationale.
 */
@Singleton(TEAM_TOKENS.TeamAIIntegrationHttpService)
export default class TeamAIIntegrationHttpService {
    constructor(
        @inject(CreateTeamAIIntegrationUseCase) private readonly createTeamAIIntegrationUseCase: CreateTeamAIIntegrationUseCase,
        @inject(DeleteTeamAIIntegrationUseCase) private readonly deleteTeamAIIntegrationUseCase: DeleteTeamAIIntegrationUseCase,
        @inject(GetTeamAIIntegrationModelsUseCase) private readonly getTeamAIIntegrationModelsUseCase: GetTeamAIIntegrationModelsUseCase,
        @inject(GetTeamAIIntegrationsUseCase) private readonly getTeamAIIntegrationsUseCase: GetTeamAIIntegrationsUseCase,
        @inject(UpdateTeamAIIntegrationUseCase) private readonly updateTeamAIIntegrationUseCase: UpdateTeamAIIntegrationUseCase
    ) {}

    listByTeamId(
        input: UseCaseInput<GetTeamAIIntegrationsUseCase>
    ): Promise<UseCaseOutput<GetTeamAIIntegrationsUseCase>> {
        return this.getTeamAIIntegrationsUseCase.execute(input);
    }

    createByProvider(
        input: UseCaseInput<CreateTeamAIIntegrationUseCase>
    ): Promise<UseCaseOutput<CreateTeamAIIntegrationUseCase>> {
        return this.createTeamAIIntegrationUseCase.execute(input);
    }

    updateByProvider(
        input: UseCaseInput<UpdateTeamAIIntegrationUseCase>
    ): Promise<UseCaseOutput<UpdateTeamAIIntegrationUseCase>> {
        return this.updateTeamAIIntegrationUseCase.execute(input);
    }

    deleteByProvider(
        input: UseCaseInput<DeleteTeamAIIntegrationUseCase>
    ): Promise<UseCaseOutput<DeleteTeamAIIntegrationUseCase>> {
        return this.deleteTeamAIIntegrationUseCase.execute(input);
    }

    listModels(
        input: UseCaseInput<GetTeamAIIntegrationModelsUseCase>
    ): Promise<UseCaseOutput<GetTeamAIIntegrationModelsUseCase>> {
        return this.getTeamAIIntegrationModelsUseCase.execute(input);
    }
}
