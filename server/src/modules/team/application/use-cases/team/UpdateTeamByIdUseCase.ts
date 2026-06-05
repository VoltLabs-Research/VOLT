import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import type { TeamProps } from '@modules/team/domain/entities/team/Team';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import type { FindOptions } from '@shared/domain/port/IBaseRepository';
import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

interface UpdateTeamByIdInput {
    teamId: string;
    data: Partial<TeamProps>;
    options?: Pick<FindOptions<unknown>, 'populate' | 'select'>;
}

@injectable()
export default class UpdateTeamByIdUseCase implements IUseCase<UpdateTeamByIdInput, PersistedOutput<TeamProps>, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamRepository) private readonly repository: ITeamRepository
    ) {}

    async execute(input: UpdateTeamByIdInput): Promise<Result<PersistedOutput<TeamProps>, ApplicationError>> {
        const entity = await this.repository.updateById(input.teamId, input.data, input.options);
        if (!entity) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            ));
        }
        return Result.ok(toPersistedOutput(entity));
    }
}
