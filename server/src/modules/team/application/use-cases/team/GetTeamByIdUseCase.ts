import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';
import type { TeamProps } from '@modules/team/domain/entities/team/Team';
import type { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import type { FindOptions } from '@shared/domain/port/IBaseRepository';
import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';

interface GetTeamByIdInput {
    teamId: string;
    options?: Pick<FindOptions<unknown>, 'populate' | 'select'>;
};

@injectable()
export default class GetTeamByIdUseCase implements IUseCase<GetTeamByIdInput, PersistedOutput<TeamProps>, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private readonly repository: ITeamRepository
    ) {}

    async execute(input: GetTeamByIdInput): Promise<Result<PersistedOutput<TeamProps>, ApplicationError>> {
        const entity = await this.repository.findById(input.teamId, input.options);
        if (!entity) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            ));
        }
        return Result.ok(toPersistedOutput(entity));
    }
};
