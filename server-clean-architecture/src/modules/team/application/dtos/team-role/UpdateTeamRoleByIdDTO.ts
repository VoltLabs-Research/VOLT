import { TeamRoleProps } from '@modules/team/domain/entities/TeamRole';

export interface UpdateTeamRoleByIdInputDTO{
    roleId: string;
    name?: string;
    permissions?: string[];
};

export interface UpdateTeamRoleByIdOutputDTO extends TeamRoleProps{};