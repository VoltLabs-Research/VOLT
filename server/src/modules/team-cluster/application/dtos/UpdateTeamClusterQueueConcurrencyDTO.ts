import type { TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';
import type { TeamClusterDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';

export interface TeamClusterQueueConcurrencyInputDTO {
    analysis: number;
    rasterizer: number;
    glbPreprocessing: number;
    sshImport: number;
};

export interface TeamClusterQueueScopeLimitInputDTO {
    maxRunningPerTrajectory: number;
    maxRunningPerTeam: number;
};

export interface TeamClusterQueueScopeLimitsInputDTO {
    analysisProcessing: TeamClusterQueueScopeLimitInputDTO;
    artifactUpload: TeamClusterQueueScopeLimitInputDTO;
    trajectoryGlbConversion: TeamClusterQueueScopeLimitInputDTO;
    cloudUpload: TeamClusterQueueScopeLimitInputDTO;
    trajectoryCompression: TeamClusterQueueScopeLimitInputDTO;
};

export interface UpdateTeamClusterQueueConcurrencyInputDTO extends TeamScopedEntityIdInputDTO<'teamClusterId'> {
    queueConcurrency: TeamClusterQueueConcurrencyInputDTO;
    queueScopeLimits: TeamClusterQueueScopeLimitsInputDTO;
};

export interface UpdateTeamClusterQueueConcurrencyOutputDTO {
    message: string;
    teamCluster: TeamClusterDTO;
};
