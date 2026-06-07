import { EntityOutputDTO } from '@modules/team/application/dtos/common';
import { TeamRoleProps } from '@modules/team/domain/entities/team-role/TeamRole';

export interface CreateTeamRoleInputDTO {
    teamId: string;
    name: string;
    permissions: string[];
    isSystem: boolean;
    userId: string;
}

export type CreateTeamRoleOutputDTO = EntityOutputDTO<TeamRoleProps>;
