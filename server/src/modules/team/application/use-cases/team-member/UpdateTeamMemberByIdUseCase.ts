import { ErrorCodes } from '@core/constants/error-codes';
import type { TeamMemberProps } from '@modules/team/domain/entities/team-member/TeamMember';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-member/TeamMemberRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import type { FindOptions } from '@shared/domain/port/IBaseRepository';
import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

interface UpdateTeamMemberByIdInput {
    teamMemberId: string;
    data: Partial<TeamMemberProps>;
    options?: Pick<FindOptions<unknown>, 'populate' | 'select'>;
};

@injectable()
export default class UpdateTeamMemberByIdUseCase implements IUseCase<UpdateTeamMemberByIdInput, PersistedOutput<TeamMemberProps>, ApplicationError> {
    constructor(
        
        private readonly repository: TeamMemberRepository
    ) {}

    async execute(input: UpdateTeamMemberByIdInput): Promise<Result<PersistedOutput<TeamMemberProps>, ApplicationError>> {
        const entity = await this.repository.updateById(input.teamMemberId, input.data, input.options);
        if (!entity) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_MEMBER_NOT_FOUND,
                'TeamMember not found'
            ));
        }
        return Result.ok(toPersistedOutput(entity));
    }
};
