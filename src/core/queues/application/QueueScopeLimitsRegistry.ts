import { DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS } from '@/core/runtime/contracts/team-cluster-runtime';
import type { TeamClusterDaemonQueueScopeLimits } from '@/core/runtime/contracts/team-cluster-runtime';

export type QueueScopeKey = keyof TeamClusterDaemonQueueScopeLimits;

export type ScopeRelease = () => void;

const normalizeQueueScopeLimits = (
    queueScopeLimits: Partial<TeamClusterDaemonQueueScopeLimits>
): TeamClusterDaemonQueueScopeLimits => ({
    analysisProcessing: {
        ...DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS.analysisProcessing,
        ...queueScopeLimits.analysisProcessing
    },
    artifactUpload: {
        ...DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS.artifactUpload,
        ...queueScopeLimits.artifactUpload
    },
    trajectoryRasterization: {
        ...DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS.trajectoryRasterization,
        ...queueScopeLimits.trajectoryRasterization
    },
    trajectoryGlbConversion: {
        ...DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS.trajectoryGlbConversion,
        ...queueScopeLimits.trajectoryGlbConversion
    },
    cloudUpload: {
        ...DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS.cloudUpload,
        ...queueScopeLimits.cloudUpload
    },
    trajectoryCompression: {
        ...DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS.trajectoryCompression,
        ...queueScopeLimits.trajectoryCompression
    }
});

export class QueueScopeLimitsRegistry {
    private queueScopeLimits: TeamClusterDaemonQueueScopeLimits = DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS;

    private readonly byTrajectory = new Map<string, number>();
    private readonly byTeam = new Map<string, number>();

    readonly apply = (queueScopeLimits: TeamClusterDaemonQueueScopeLimits): void => {
        this.queueScopeLimits = normalizeQueueScopeLimits(queueScopeLimits);
    };

    readonly getSnapshot = (): TeamClusterDaemonQueueScopeLimits => {
        return this.queueScopeLimits;
    };

    tryAcquire(
        scope: QueueScopeKey,
        trajectoryId: string | undefined,
        teamId: string | undefined
    ): ScopeRelease | null {
        const limit = this.queueScopeLimits[scope];
        if (!limit) {
            return () => undefined;
        }

        const trajectoryKey = trajectoryId ? `${scope}:${trajectoryId}` : null;
        const teamKey = teamId ? `${scope}:${teamId}` : null;

        const trajectoryCount = trajectoryKey ? this.byTrajectory.get(trajectoryKey) ?? 0 : 0;
        const teamCount = teamKey ? this.byTeam.get(teamKey) ?? 0 : 0;

        if (limit.maxRunningPerTrajectory > 0 && trajectoryKey && trajectoryCount >= limit.maxRunningPerTrajectory) {
            return null;
        }
        if (limit.maxRunningPerTeam > 0 && teamKey && teamCount >= limit.maxRunningPerTeam) {
            return null;
        }

        if (trajectoryKey) this.byTrajectory.set(trajectoryKey, trajectoryCount + 1);
        if (teamKey) this.byTeam.set(teamKey, teamCount + 1);

        let released = false;
        return () => {
            if (released) return;
            released = true;
            if (trajectoryKey) {
                const next = (this.byTrajectory.get(trajectoryKey) ?? 1) - 1;
                if (next <= 0) this.byTrajectory.delete(trajectoryKey);
                else this.byTrajectory.set(trajectoryKey, next);
            }
            if (teamKey) {
                const next = (this.byTeam.get(teamKey) ?? 1) - 1;
                if (next <= 0) this.byTeam.delete(teamKey);
                else this.byTeam.set(teamKey, next);
            }
        };
    }
}
