import type {
    TeamClusterQueueScopeLimitProps,
    TeamClusterQueueScopeLimitsProps
} from '@modules/cluster/domain/entities/TeamCluster';

export type TeamClusterScopedQueueLimitKey =
    | 'analysisProcessing'
    | 'artifactUpload'
    | 'trajectoryRasterization'
    | 'trajectoryGlbConversion';

export interface ITeamClusterQueueScopeLimitsService {
    getLimits(
        teamClusterId: string,
        queueKey: TeamClusterScopedQueueLimitKey
    ): Promise<TeamClusterQueueScopeLimitProps>;
    getSnapshot(teamClusterId: string): Promise<TeamClusterQueueScopeLimitsProps>;
}
