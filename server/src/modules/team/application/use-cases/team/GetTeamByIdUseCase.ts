import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import type { TeamProps } from '@modules/team/domain/entities/team/Team';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import type { FindOptions } from '@shared/domain/port/IBaseRepository';
import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { inject, injectable } from 'tsyringe';

interface GetTeamByIdInput {
    teamId: string;
    options?: Pick<FindOptions<unknown>, 'populate' | 'select'>;
}

@injectable()
export default class GetTeamByIdUseCase implements IUseCase<GetTeamByIdInput, PersistedOutput<TeamProps>> {
    constructor(
        @inject(TEAM_TOKENS.TeamRepository) private readonly repository: ITeamRepository
    ) {}

    async execute(input: GetTeamByIdInput): Promise<PersistedOutput<TeamProps>> {
        const entity = await this.repository.findById(input.teamId, input.options);
        if (!entity) {
            throw ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            );
        }
        return toPersistedOutput(entity);
    }
}
