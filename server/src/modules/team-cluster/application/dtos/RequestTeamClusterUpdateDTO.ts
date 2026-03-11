import type { TeamUserScopedInputDTO } from '@modules/team/application/dtos/common';
import type { TeamClusterDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';

export interface RequestTeamClusterUpdateInputDTO extends TeamUserScopedInputDTO {
    teamClusterId: string;
    targetVersion: string;
    isEdge: boolean;
    password: string;
};

export interface RequestTeamClusterUpdateOutputDTO {
    message: string;
    teamCluster: TeamClusterDTO;
};
