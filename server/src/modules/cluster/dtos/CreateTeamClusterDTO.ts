import type { TeamUserScopedInputDTO } from '@modules/team/dtos/common';
import type { TeamClusterDTO } from '@modules/cluster/dtos/TeamClusterDTO';

export interface CreateTeamClusterInputDTO extends TeamUserScopedInputDTO {
    name: string;
}

export interface CreateTeamClusterOutputDTO {
    teamCluster: TeamClusterDTO;
    enrollmentToken: string;
}
