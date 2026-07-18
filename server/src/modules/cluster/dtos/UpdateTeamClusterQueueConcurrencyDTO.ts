import type { TeamScopedEntityIdInputDTO } from '@modules/team/dtos/common';
import type { TeamClusterDTO } from '@modules/cluster/dtos/TeamClusterDTO';

export interface TeamClusterQueueConcurrencyInputDTO {
    analysis: number;
    rasterizer: number;
    glbPreprocessing: number;
    artifactUpload: number;
    pluginWarmup: number;
}

export interface TeamClusterQueueScopeLimitInputDTO {
    maxRunningPerTrajectory: number;
}

export interface TeamClusterQueueScopeLimitsInputDTO {
    analysisProcessing: TeamClusterQueueScopeLimitInputDTO;
    artifactUpload: TeamClusterQueueScopeLimitInputDTO;
    trajectoryRasterization: TeamClusterQueueScopeLimitInputDTO;
    trajectoryGlbConversion: TeamClusterQueueScopeLimitInputDTO;
}

export interface UpdateTeamClusterQueueConcurrencyInputDTO extends TeamScopedEntityIdInputDTO<'teamClusterId'> {
    queueConcurrency: TeamClusterQueueConcurrencyInputDTO;
    queueScopeLimits: TeamClusterQueueScopeLimitsInputDTO;
}

export interface UpdateTeamClusterQueueConcurrencyOutputDTO {
    message: string;
    teamCluster: TeamClusterDTO;
}
