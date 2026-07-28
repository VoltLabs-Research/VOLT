import { getRedisConnection } from '@shared/infrastructure/redis/RedisConnection';
import type {
    AnalysisRuntimeCleanupRequest,
    RuntimeStateCleanupResponse,
    TrajectoryRuntimeCleanupRequest
} from '@shared/contracts';
import type { RedisConnection } from '@shared/infrastructure/redis/RedisConnection';

export class RuntimeStateCleanupControl {
    constructor(
        private readonly redisConnection: RedisConnection
    ) {}

    async cleanupAnalysisRuntimeState(
        input: AnalysisRuntimeCleanupRequest
    ): Promise<RuntimeStateCleanupResponse> {
        const deletedKeys = await this.redisConnection.deleteKeys(this.distinctKeys([
            this.analysisPendingJobsKey(input.analysisId),
            ...this.removedAnalysisJobKeys(input.jobIds)
        ]));

        return { deletedKeys };
    }

    async cleanupTrajectoryRuntimeState(
        input: TrajectoryRuntimeCleanupRequest
    ): Promise<RuntimeStateCleanupResponse> {
        const deletedKeys = await this.redisConnection.deleteKeys(this.distinctKeys([
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

let runtimeStateCleanupControlInstance: RuntimeStateCleanupControl | null = null;

export const getRuntimeStateCleanupControl = (): RuntimeStateCleanupControl => {
    runtimeStateCleanupControlInstance ??= new RuntimeStateCleanupControl(getRedisConnection());
    return runtimeStateCleanupControlInstance;
};
