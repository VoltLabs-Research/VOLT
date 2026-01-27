import type { TeamRole, TeamRolePayload } from '../entities';

export interface ITeamRoleRepository {
    getAll(): Promise<TeamRole[]>;
    create(data: TeamRolePayload): Promise<TeamRole>;
    update(roleId: string, data: Partial<TeamRolePayload>): Promise<TeamRole>;
    deleteRole(roleId: string): Promise<void>;
}
