import { IBaseRepository } from "@/src/shared/domain/IBaseRepository";
import Team, { TeamProps } from '../entities/Team';

export interface ITeamRepository extends IBaseRepository<Team, TeamProps>{
    /**
     * Remove a user from the specified team.
     */
    removeUserFromTeam(
        userId: string,
        teamId: string
    ): Promise<void>;

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
};