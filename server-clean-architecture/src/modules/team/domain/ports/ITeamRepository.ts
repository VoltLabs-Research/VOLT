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
};