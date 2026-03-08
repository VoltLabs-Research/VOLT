import { Result } from '@shared/domain/port/Result';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';

export async function ensureTeamMembersExist(
    teamMemberRepo: ITeamMemberRepository,
    teamId: string,
    userIds: string[]
): Promise<Result<null, ApplicationError>> {
    const memberChecks: Array<unknown | null> = await Promise.all(
        userIds.map((userId) => teamMemberRepo.findOne({ team: teamId, user: userId }))
    );

    const invalidIndex = memberChecks.findIndex((member: unknown | null) => !member);

    if (invalidIndex !== -1) {
        return Result.fail(ApplicationError.notFound(
            ErrorCodes.TEAM_MEMBER_NOT_FOUND,
            `User ${userIds[invalidIndex]} is not a member of this team`
        ));
    }

    return Result.ok(null);
}
