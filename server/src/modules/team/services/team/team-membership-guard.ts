import { ErrorCodes } from '@core/constants/error-codes';
import TeamMember from '@modules/team/models/TeamMember';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type TeamRole from '@modules/team/models/TeamRole';

/**
 * The single answer to "is this user a member of this team?".
 *
 * This used to be reimplemented in every module that needed it, and the copies
 * disagreed on the outcome: most answered 403, but one answered 404, so the same
 * denial produced a different status depending on which endpoint you hit.
 * Membership is an authorization fact, so a non-member is always 403 — a 404
 * would additionally leak whether the team exists.
 */

export const isTeamMember = async (teamId: string, userId?: string | null): Promise<boolean> => {
    if (!userId) return false;

    return TeamMember.existsBy({
        team: teamId,
        user: userId
    });
};

export const membershipForbidden = (): ApplicationError => ApplicationError.forbidden(
    ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
    'You are not a member of this team'
);

/** Throws unless `userId` is a member of `teamId`. */
export const assertTeamMembership = async (teamId: string, userId?: string | null): Promise<void> => {
    if (!await isTeamMember(teamId, userId)) {
        throw membershipForbidden();
    }
};

/**
 * Like `assertTeamMembership`, but returns the membership row with its role
 * loaded, for callers that need the member's permissions.
 */
export const requireTeamMembership = async (
    teamId: string,
    userId?: string | null
): Promise<TeamMember & { roleRef?: TeamRole | null }> => {
    if (!userId) throw membershipForbidden();

    const member = await TeamMember.findOne({
        where: {
            user: userId,
            team: teamId
        },
        relations: { roleRef: true }
    });

    if (!member) throw membershipForbidden();

    return member;
};

/** Throws naming the first user in `userIds` that is not a member of `teamId`. */
export const assertAllTeamMembers = async (teamId: string, userIds: string[]): Promise<void> => {
    const members = await TeamMember.find({
        where: userIds.map((user) => ({
            team: teamId,
            user
        }))
    });

    const memberUserIds = new Set(members.map((member) => member.user));
    const missing = userIds.find((userId) => !memberUserIds.has(userId));

    if (missing !== undefined) {
        throw ApplicationError.forbidden(
            ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
            `User ${missing} is not a member of this team`
        );
    }
};
