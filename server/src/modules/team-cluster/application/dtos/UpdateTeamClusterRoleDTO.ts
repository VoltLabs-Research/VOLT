import type { TeamUserScopedInputDTO } from '@modules/team/application/dtos/common';
import type { TeamClusterDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';
import type { TeamClusterRole } from '@modules/team-cluster/domain/entities/TeamCluster';

export interface UpdateTeamClusterRoleInputDTO extends TeamUserScopedInputDTO {
    teamClusterId: string;
    role: TeamClusterRole;
};

export interface UpdateTeamClusterRoleOutputDTO {
    teamCluster: TeamClusterDTO;
};
