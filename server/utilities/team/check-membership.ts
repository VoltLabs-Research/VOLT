import { Team } from '@/models/index';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@shared/constants/error-codes';
import { ITeam } from '@/types/models/team';

export const checkTeamMembership = async (teamId: string, userId: string): Promise<ITeam> => {
    const team = await Team.findOne({ _id: teamId, members: userId });
    if (!team) {
        throw new RuntimeError(ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN, 403);
    }
    return team;
};

export const checkTeamOwnership = async (teamId: string, userId: string): Promise<ITeam> => {
    const team = await Team.findOne({ _id: teamId, owner: userId });
    if (!team) {
        throw new RuntimeError(ErrorCodes.TEAM_OWNERSHIP_FORBIDDEN, 403);
    }
    return team;
};
    
export const checkTeamAccess = async (teamId: string, userId: string): Promise<ITeam> => {
    const team = await Team.findOne({
        _id: teamId,
        $or: [{ owner: userId }, { members: userId }]
    });
    if (!team) {
        throw new RuntimeError(ErrorCodes.TEAM_ACCESS_DENIED, 403);
    }
    return team;
};