import type { TeamRole } from '../../entities/role';

export interface CreateTeamRoleParams {
    name: string;
    permissions: string[];
};

export interface CreateTeamRoleInputDTO {
    teamId: string;
    name: string;
    permissions: string[];
};

export type CreateTeamRoleOutputDTO = TeamRole;
