import { IBaseRepository } from "@/src/shared/domain/IBaseRepository";
import TeamRole, { TeamRoleProps } from '../entities/TeamRole';

export interface ITeamRoleRepository extends IBaseRepository<TeamRole, TeamRoleProps>{
    /**
     * Find all roles for a specified team.
     */
    findByTeamId(teamId: string): Promise<TeamRole[]>;

    /**
     * Create a new role for a specified team.
     */
    createByTeamId(
        teamId: string, 
        data: Partial<TeamRoleProps>
    ): Promise<TeamRole>;
};