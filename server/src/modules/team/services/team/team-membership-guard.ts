import { ErrorCodes } from '@core/constants/error-codes';
import TeamMember from '@modules/team/models/TeamMember';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type TeamRole from '@modules/team/models/TeamRole';


export const isTeamMember = async (teamId: string, userId?: string | null): Promise<boolean> => {
    if (!userId) return false;

    return TeamMember.existsBy({
        team: teamId,
        user: userId
    });
};

const membershipForbidden = (): ApplicationError => ApplicationError.forbidden(
    ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
    'You are not a member of this team'
);

export const assertTeamMembership = async (teamId: string, userId?: string | null): Promise<void> => {
    if (!await isTeamMember(teamId, userId)) {
        throw membershipForbidden();
    }
};

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
