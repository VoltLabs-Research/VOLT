import type { TeamUserScopedInputDTO } from '@modules/team/application/dtos/common';
import type { TeamClusterDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';

export interface CreateTeamClusterInputDTO extends TeamUserScopedInputDTO {
    name: string;
};

export interface CreateTeamClusterOutputDTO {
    teamCluster: TeamClusterDTO;
    enrollmentToken: string;
};
