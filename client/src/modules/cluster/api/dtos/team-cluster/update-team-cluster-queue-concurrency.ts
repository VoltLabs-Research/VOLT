import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

export interface TeamClusterQueueConcurrencyInputDTO {
    analysis: number;
    rasterizer: number;
    glbPreprocessing: number;
    sshImport: number;
};

export interface UpdateTeamClusterQueueConcurrencyInputDTO {
    teamId: string;
    teamClusterId: string;
    queueConcurrency: TeamClusterQueueConcurrencyInputDTO;
};

export interface UpdateTeamClusterQueueConcurrencyOutputDTO {
    message: string;
    restartRequested: boolean;
    teamCluster: TeamCluster;
};
