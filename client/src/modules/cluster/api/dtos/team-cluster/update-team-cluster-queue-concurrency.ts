import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

export interface TeamClusterQueueConcurrencyInputDTO {
    analysis: number;
    rasterizer: number;
    glbPreprocessing: number;
    artifactUpload: number;
    sshImport: number;
};

export interface TeamClusterQueueScopeLimitInputDTO {
    maxRunningPerTrajectory: number;
    maxRunningPerTeam: number;
};

export interface TeamClusterQueueScopeLimitsInputDTO {
    analysisProcessing: TeamClusterQueueScopeLimitInputDTO;
    artifactUpload: TeamClusterQueueScopeLimitInputDTO;
    trajectoryRasterization: TeamClusterQueueScopeLimitInputDTO;
    trajectoryGlbConversion: TeamClusterQueueScopeLimitInputDTO;
    cloudUpload: TeamClusterQueueScopeLimitInputDTO;
    trajectoryCompression: TeamClusterQueueScopeLimitInputDTO;
};

export interface UpdateTeamClusterQueueConcurrencyInputDTO {
    teamId: string;
    teamClusterId: string;
    queueConcurrency: TeamClusterQueueConcurrencyInputDTO;
    queueScopeLimits: TeamClusterQueueScopeLimitsInputDTO;
};

export interface UpdateTeamClusterQueueConcurrencyOutputDTO {
    message: string;
    restartRequested: boolean;
    teamCluster: TeamCluster;
};
