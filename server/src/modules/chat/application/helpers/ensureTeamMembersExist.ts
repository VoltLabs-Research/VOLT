import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { ITeamMemberRepository } from '@modules/team/domain/port/ITeamMemberRepository';

export async function ensureTeamMembersExist(
    teamMemberRepo: ITeamMemberRepository,
    teamId: string,
    userIds: string[]
): Promise<Result<null, ApplicationError>> {
    const memberChecks = await Promise.all(
        userIds.map((userId) => teamMemberRepo.findOne({ team: teamId, user: userId }))
    );

    const invalidIndex = memberChecks.findIndex((member) => !member);

    if (invalidIndex !== -1) {
        return Result.fail(ApplicationError.notFound(
            ErrorCodes.TEAM_MEMBER_NOT_FOUND,
            `User ${userIds[invalidIndex]} is not a member of this team`
        ));
    }

    return Result.ok(null);
}
