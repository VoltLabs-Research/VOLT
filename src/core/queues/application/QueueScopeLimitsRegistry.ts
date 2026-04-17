import { DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS } from '@/core/runtime/contracts/teamClusterRuntime';
import type { TeamClusterDaemonQueueScopeLimits } from '@/core/runtime/contracts/teamClusterRuntime';

export class QueueScopeLimitsRegistry {
    private queueScopeLimits: TeamClusterDaemonQueueScopeLimits = DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS;

    readonly apply = (queueScopeLimits: TeamClusterDaemonQueueScopeLimits): void => {
        this.queueScopeLimits = queueScopeLimits;
    };

    readonly getSnapshot = (): TeamClusterDaemonQueueScopeLimits => {
        return this.queueScopeLimits;
    };
}
