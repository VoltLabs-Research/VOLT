import { TeamRoleProps } from "../../../domain/entities/TeamRole";

export interface CreateTeamRoleInputDTO{
    name: string;
    teamId: string;
    isSystem: boolean;
    permissions: string[];
};

export interface CreateTeamRoleOutputDTO extends TeamRoleProps{}