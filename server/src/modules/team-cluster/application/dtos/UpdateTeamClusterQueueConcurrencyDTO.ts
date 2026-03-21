import type { TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';
import type { TeamClusterDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';

export interface TeamClusterQueueConcurrencyInputDTO {
    analysis: number;
    rasterizer: number;
    glbPreprocessing: number;
    sshImport: number;
};

export interface UpdateTeamClusterQueueConcurrencyInputDTO extends TeamScopedEntityIdInputDTO<'teamClusterId'> {
    queueConcurrency: TeamClusterQueueConcurrencyInputDTO;
};

export interface UpdateTeamClusterQueueConcurrencyOutputDTO {
    message: string;
    teamCluster: TeamClusterDTO;
};
