import type {
    TeamClusterQueueScopeLimitProps,
    TeamClusterQueueScopeLimitsProps
} from '@shared/contracts/types';

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
