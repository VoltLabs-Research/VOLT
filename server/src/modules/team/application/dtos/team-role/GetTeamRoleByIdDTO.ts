import { TeamRoleProps } from '@modules/team/domain/entities/TeamRole';

export interface GetTeamRoleByIdInputDTO{
    roleId: string;
};

export interface GetTeamRoleByIdOutputDTO extends TeamRoleProps{}