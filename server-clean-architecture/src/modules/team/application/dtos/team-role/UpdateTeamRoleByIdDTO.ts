import { TeamRoleProps } from "../../../domain/entities/TeamRole";

export interface UpdateTeamRoleByIdInputDTO{
    roleId: string;
    name?: string;
    permissions?: string[];
};

export interface UpdateTeamRoleByIdOutputDTO extends TeamRoleProps{};