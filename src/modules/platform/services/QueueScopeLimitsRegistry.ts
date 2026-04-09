import {
    DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS,
    type TeamClusterDaemonQueueScopeLimits
} from '@/shared/contracts';

const cloneQueueScopeLimits = (
    queueScopeLimits: TeamClusterDaemonQueueScopeLimits
): TeamClusterDaemonQueueScopeLimits => ({
    analysisProcessing: {
        ...queueScopeLimits.analysisProcessing
    },
    artifactUpload: {
        ...queueScopeLimits.artifactUpload
    },
    trajectoryGlbConversion: {
        ...queueScopeLimits.trajectoryGlbConversion
    },
    cloudUpload: {
        ...queueScopeLimits.cloudUpload
    },
    trajectoryCompression: {
        ...queueScopeLimits.trajectoryCompression
    }
});

export class QueueScopeLimitsRegistry {
    private queueScopeLimits = cloneQueueScopeLimits(DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS);

    apply(queueScopeLimits: TeamClusterDaemonQueueScopeLimits): void {
        this.queueScopeLimits = cloneQueueScopeLimits(queueScopeLimits);
    }

    getSnapshot(): TeamClusterDaemonQueueScopeLimits {
        return cloneQueueScopeLimits(this.queueScopeLimits);
    }
}
