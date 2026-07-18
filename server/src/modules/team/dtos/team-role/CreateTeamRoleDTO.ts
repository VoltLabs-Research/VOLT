import { EntityOutputDTO } from '@modules/team/dtos/common';
import { TeamRoleProps } from '@modules/team/entities/team-role/TeamRole';

export interface CreateTeamRoleInputDTO {
    teamId: string;
    name: string;
    permissions: string[];
    isSystem: boolean;
    userId: string;
}

export type CreateTeamRoleOutputDTO = EntityOutputDTO<TeamRoleProps>;
