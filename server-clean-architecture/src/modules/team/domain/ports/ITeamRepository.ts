import { IBaseRepository } from '@shared/domain/ports/IBaseRepository';
import Team, { TeamProps } from '@modules/team/domain/entities/Team';

export interface TeamMemberInfo{
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
};

export interface ITeamRepository extends IBaseRepository<Team, TeamProps>{
    /**
     * Remove a user from the specified team.
     */
    removeUserFromTeam(
        userId: string,
        teamId: string
    ): Promise<void>;

    addMemberToTeam(memberId: string, teamId: string): Promise<void>;
    addRoleToTeam(roleId: string, teamId: string): Promise<void>;

    /**
     * Remove a user from all teams (members and admins arrays).
     */
    removeUserFromAllTeams(userId: string): Promise<void>;

    /**
     * Get all teams for the specified user.
     */
    findUserTeams(userId: string): Promise<TeamProps[]>;

    /**
     * Checks if user has access to the specified team.
     */
    hasAccess(
        userId: string,
        teamId: string
    ): Promise<boolean>;

    /**
     * Get team members with populated user data.
     */
    getTeamMembersWithUserData(teamId: string): Promise<TeamMemberInfo[]>;
};