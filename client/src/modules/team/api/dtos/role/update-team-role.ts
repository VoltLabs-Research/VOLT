import type { TeamRole } from '../../entities/role';

export interface UpdateTeamRoleParams {
    name?: string;
    permissions?: string[];
};

export interface UpdateTeamRoleInputDTO {
    teamId: string;
    roleId: string;
    name?: string;
    permissions?: string[];
};

export type UpdateTeamRoleOutputDTO = TeamRole;
