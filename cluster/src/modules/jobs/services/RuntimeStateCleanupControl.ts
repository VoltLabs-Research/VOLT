import { singleton } from '@shared/application/utilities/singleton';
import { getDaemonStateStore } from '@shared/infrastructure/persistence/DaemonStateStore';
import type {
    AnalysisRuntimeCleanupRequest,
    RuntimeStateCleanupResponse,
    TrajectoryRuntimeCleanupRequest
} from '@shared/contracts';
import type { DaemonStateStore } from '@shared/infrastructure/persistence/DaemonStateStore';

export class RuntimeStateCleanupControl {
    constructor(
        private readonly stateStore: DaemonStateStore
    ) {}

    async cleanupAnalysisRuntimeState(
        input: AnalysisRuntimeCleanupRequest
    ): Promise<RuntimeStateCleanupResponse> {
        const deletedKeys = await this.stateStore.deleteKeys(this.distinctKeys([
            this.analysisPendingJobsKey(input.analysisId),
            ...this.removedAnalysisJobKeys(input.jobIds)
        ]));

        return { deletedKeys };
    }

    async cleanupTrajectoryRuntimeState(
        input: TrajectoryRuntimeCleanupRequest
    ): Promise<RuntimeStateCleanupResponse> {
        const deletedKeys = await this.stateStore.deleteKeys(this.distinctKeys([
            this.trajectoryFrameRemainingKey(input.trajectoryId),
            this.trajectoryFrameSessionFramesKey(input.trajectoryId),
            this.trajectoryAutoPreviewKey(input.trajectoryId),
            ...(input.analysisIds ?? []).map((analysisId) => this.analysisPendingJobsKey(analysisId)),
            ...this.removedAnalysisJobKeys(input.jobIds)
        ]));

        return { deletedKeys };
    }

    private removedAnalysisJobKeys(jobIds: string[] | undefined): string[] {
        return (jobIds ?? []).map((jobId) => `analysis:removed-job:${jobId}`);
    }

    private analysisPendingJobsKey(analysisId: string): string {
        return `analysis:${analysisId}:pending-jobs`;
    }

    private trajectoryFrameRemainingKey(trajectoryId: string): string {
        return `trajectory-frame-session:${trajectoryId}:remaining`;
    }

    private trajectoryFrameSessionFramesKey(trajectoryId: string): string {
        return `trajectory-frame-session:${trajectoryId}:frames`;
    }

    private trajectoryAutoPreviewKey(trajectoryId: string): string {
        return `trajectory:${trajectoryId}:auto-preview-raster`;
    }

    private distinctKeys(keys: string[]): string[] {
        return [...new Set(keys)];
    }
}

export const getRuntimeStateCleanupControl = singleton((): RuntimeStateCleanupControl => new RuntimeStateCleanupControl(getDaemonStateStore()));
