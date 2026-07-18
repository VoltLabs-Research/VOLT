import CreateSecretKeyUseCase from '@modules/team/use-cases/secret-key/CreateSecretKeyUseCase';
import DeleteSecretKeyByIdUseCase from '@modules/team/use-cases/secret-key/DeleteSecretKeyByIdUseCase';
import GetCurrentSecretKeyUseCase from '@modules/team/use-cases/secret-key/GetCurrentSecretKeyUseCase';
import GetSecretKeyTeamMetricsUseCase from '@modules/team/use-cases/secret-key/GetSecretKeyTeamMetricsUseCase';
import GetSecretKeyUsageUseCase from '@modules/team/use-cases/secret-key/GetSecretKeyUsageUseCase';
import ListSecretKeysByTeamIdUseCase from '@modules/team/use-cases/secret-key/ListSecretKeysByTeamIdUseCase';
import RevokeSecretKeyByIdUseCase from '@modules/team/use-cases/secret-key/RevokeSecretKeyByIdUseCase';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import type { UseCaseInput, UseCaseOutput } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

/**
 * The HTTP-facing application service for the secret-key resource. Thin
 * delegators to retained use cases, returning each use case's value and letting a thrown
 * `ApplicationError` reach the global `httpErrorMiddleware`. See {@link TeamHttpService} for the shared rationale.
 */
@Singleton(TEAM_TOKENS.SecretKeyHttpService)
export default class SecretKeyHttpService {
    constructor(
        @inject(CreateSecretKeyUseCase) private readonly createSecretKeyUseCase: CreateSecretKeyUseCase,
        @inject(DeleteSecretKeyByIdUseCase) private readonly deleteSecretKeyByIdUseCase: DeleteSecretKeyByIdUseCase,
        @inject(GetCurrentSecretKeyUseCase) private readonly getCurrentSecretKeyUseCase: GetCurrentSecretKeyUseCase,
        @inject(GetSecretKeyTeamMetricsUseCase) private readonly getSecretKeyTeamMetricsUseCase: GetSecretKeyTeamMetricsUseCase,
        @inject(GetSecretKeyUsageUseCase) private readonly getSecretKeyUsageUseCase: GetSecretKeyUsageUseCase,
        @inject(ListSecretKeysByTeamIdUseCase) private readonly listSecretKeysByTeamIdUseCase: ListSecretKeysByTeamIdUseCase,
        @inject(RevokeSecretKeyByIdUseCase) private readonly revokeSecretKeyByIdUseCase: RevokeSecretKeyByIdUseCase
    ) {}

    create(
        input: UseCaseInput<CreateSecretKeyUseCase>
    ): Promise<UseCaseOutput<CreateSecretKeyUseCase>> {
        return this.createSecretKeyUseCase.execute(input);
    }

    current(
        input: UseCaseInput<GetCurrentSecretKeyUseCase>
    ): Promise<UseCaseOutput<GetCurrentSecretKeyUseCase>> {
        return this.getCurrentSecretKeyUseCase.execute(input);
    }

    listByTeamId(
        input: UseCaseInput<ListSecretKeysByTeamIdUseCase>
    ): Promise<UseCaseOutput<ListSecretKeysByTeamIdUseCase>> {
        return this.listSecretKeysByTeamIdUseCase.execute(input);
    }

    revokeById(
        input: UseCaseInput<RevokeSecretKeyByIdUseCase>
    ): Promise<UseCaseOutput<RevokeSecretKeyByIdUseCase>> {
        return this.revokeSecretKeyByIdUseCase.execute(input);
    }

    deleteById(
        input: UseCaseInput<DeleteSecretKeyByIdUseCase>
    ): Promise<UseCaseOutput<DeleteSecretKeyByIdUseCase>> {
        return this.deleteSecretKeyByIdUseCase.execute(input);
    }

    teamMetrics(
        input: UseCaseInput<GetSecretKeyTeamMetricsUseCase>
    ): Promise<UseCaseOutput<GetSecretKeyTeamMetricsUseCase>> {
        return this.getSecretKeyTeamMetricsUseCase.execute(input);
    }

    keyUsage(
        input: UseCaseInput<GetSecretKeyUsageUseCase>
    ): Promise<UseCaseOutput<GetSecretKeyUsageUseCase>> {
        return this.getSecretKeyUsageUseCase.execute(input);
    }
}
