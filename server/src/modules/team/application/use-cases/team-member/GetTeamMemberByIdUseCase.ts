import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { TEAM_TOKENS } from '@modules/team/application/di/TeamTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import type { ITeamMemberRepository } from '@modules/team/domain/port/ITeamMemberRepository';
import type { TeamMemberProps } from '@modules/team/domain/entities/TeamMember';
import type { FindOptions } from '@shared/domain/port/IBaseRepository';

interface GetTeamMemberByIdInput {
    teamMemberId: string;
    options?: Pick<FindOptions<unknown>, 'populate' | 'select'>;
}

@injectable()
export default class GetTeamMemberByIdUseCase implements IUseCase<GetTeamMemberByIdInput, PersistedOutput<TeamMemberProps>, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly repository: ITeamMemberRepository
    ) {}

    async execute(input: GetTeamMemberByIdInput): Promise<Result<PersistedOutput<TeamMemberProps>, ApplicationError>> {
        const entity = await this.repository.findById(input.teamMemberId, input.options);
        if (!entity) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_MEMBER_NOT_FOUND,
                'TeamMember not found'
            ));
        }
        return Result.ok(toPersistedOutput(entity));
    }
}
