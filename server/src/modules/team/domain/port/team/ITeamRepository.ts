import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import Team, { TeamProps } from '@modules/team/domain/entities/team/Team';
import type { PersistedEntityOutput } from '@shared/domain/persisted/to-persisted-entity';

interface TeamMemberInfo{
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
};

export interface ITeamRepository extends IBaseRepository<Team, TeamProps>{
    /**
     * Remove a member from the specified team.
     */
    removeUserFromTeam(
        member: string,
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
    findUserTeams(userId: string): Promise<PersistedEntityOutput<TeamProps>[]>;
};
