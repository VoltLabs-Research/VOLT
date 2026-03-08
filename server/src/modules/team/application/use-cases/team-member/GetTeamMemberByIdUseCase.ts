import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';
import type { TeamMemberProps } from '@modules/team/domain/entities/team-member/TeamMember';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type { FindOptions } from '@shared/domain/port/IBaseRepository';
import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';

interface GetTeamMemberByIdInput {
    teamMemberId: string;
    options?: Pick<FindOptions<unknown>, 'populate' | 'select'>;
};

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
};
