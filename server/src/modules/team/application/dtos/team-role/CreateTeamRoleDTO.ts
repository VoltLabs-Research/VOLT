import { TeamRoleProps } from '@modules/team/domain/entities/TeamRole';

export interface CreateTeamRoleInputDTO{
    name: string;
    teamId: string;
    isSystem: boolean;
    permissions: string[];
};

export interface CreateTeamRoleOutputDTO extends TeamRoleProps{}