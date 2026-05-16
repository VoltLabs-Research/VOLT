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
    }
});

export class QueueScopeLimitsRegistry {
    private queueScopeLimits: TeamClusterDaemonQueueScopeLimits = DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS;

    private readonly byTrajectory = new Map<string, number>();
    private readonly byTrajectoryAnalysis = new Map<string, Map<string, number>>();

    readonly apply = (queueScopeLimits: TeamClusterDaemonQueueScopeLimits): void => {
        this.queueScopeLimits = normalizeQueueScopeLimits(queueScopeLimits);
    };

    readonly getSnapshot = (): TeamClusterDaemonQueueScopeLimits => this.queueScopeLimits;

    tryAcquire(
        scope: QueueScopeKey,
        trajectoryId: string | undefined,
        analysisId?: string
    ): ScopeRelease | null {
        const limit = this.queueScopeLimits[scope];
        if (!limit) {
            return () => undefined;
        }

        const trajectoryKey = trajectoryId ? `${scope}:${trajectoryId}` : null;
        if (!trajectoryKey || limit.maxRunningPerTrajectory <= 0) {
            return () => undefined;
        }

        if (analysisId) {
            return this.tryAcquireAnalysisScopedTrajectory(trajectoryKey, analysisId, limit.maxRunningPerTrajectory);
        }

        const trajectoryCount = this.byTrajectory.get(trajectoryKey) ?? 0;

        if (trajectoryCount >= limit.maxRunningPerTrajectory) {
            return null;
        }

        this.byTrajectory.set(trajectoryKey, trajectoryCount + 1);

        let released = false;
        return () => {
            if (released) return;
            released = true;
            this.decrement(this.byTrajectory, trajectoryKey);
        };
    }

    private tryAcquireAnalysisScopedTrajectory(
        trajectoryKey: string,
        analysisId: string,
        maxRunningPerTrajectory: number
    ): ScopeRelease | null {
        const analyses = this.byTrajectoryAnalysis.get(trajectoryKey) ?? new Map<string, number>();
        const activeJobsForAnalysis = analyses.get(analysisId) ?? 0;

        if (activeJobsForAnalysis === 0 && analyses.size >= maxRunningPerTrajectory) {
            return null;
        }

        analyses.set(analysisId, activeJobsForAnalysis + 1);
        this.byTrajectoryAnalysis.set(trajectoryKey, analyses);

        let released = false;
        return () => {
            if (released) return;
            released = true;
            const current = analyses.get(analysisId) ?? 1;
            if (current <= 1) {
                analyses.delete(analysisId);
            } else {
                analyses.set(analysisId, current - 1);
            }
            if (analyses.size === 0) {
                this.byTrajectoryAnalysis.delete(trajectoryKey);
            }
        };
    }

    private decrement(map: Map<string, number>, key: string | null): void {
        if (!key) return;
        const next = (map.get(key) ?? 1) - 1;
        if (next <= 0) {
            map.delete(key);
        } else {
            map.set(key, next);
        }
    }
}
