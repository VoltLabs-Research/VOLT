import { singleton } from '@shared/utilities/singleton';
import { logger } from '@shared/logger';
import { getDaemonStateStore } from '@shared/persistence/DaemonStateStore';
import { getQueueService } from '@shared/queues/QueueService';
import { getJobCancellationRegistry } from '@shared/queues/job-cancellation';
import {
    toAutoPreviewRasterClaimKey,
    toParquetDrainClaimKey,
    toRemovedJobTombstoneKey
} from '@shared/persistence/daemon-state-keys';
import { readPositiveIntegerEnv } from '@shared/utilities/env';
import type {
    AnalysisRuntimeCleanupRequest,
    RuntimeStateCleanupResponse,
    TrajectoryRuntimeCleanupResponse
} from '@shared/contracts/types/http-analysis';
import type { TrajectoryRuntimeCleanupRequest } from '@shared/contracts/types/queue-trajectory';
import type { DaemonStateStore } from '@shared/persistence/DaemonStateStore';
import type { QueueService } from '@shared/queues/QueueService';
import type { JobCancellationRegistry } from '@shared/queues/job-cancellation';

// Stays below the server's timeout for this command, so the server always gets an answer.
const CANCELLED_JOB_SETTLE_TIMEOUT_MS = readPositiveIntegerEnv('CANCELLED_JOB_SETTLE_TIMEOUT_MS') ?? 45_000;

export class RuntimeStateCleanupControl {
    constructor(
        private readonly stateStore: DaemonStateStore,
        private readonly queueService: QueueService,
        private readonly cancellation: JobCancellationRegistry
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

    // The trajectory is gone: no job of it may keep running, start, or write after this returns,
    // because the server deletes the trajectory's storage as soon as it gets the answer.
    async cleanupTrajectoryRuntimeState(
        input: TrajectoryRuntimeCleanupRequest
    ): Promise<TrajectoryRuntimeCleanupResponse> {
        const cancelled = this.cancellation.cancelTrajectory(input.trajectoryId);
        const removedJobs = await this.queueService.removeJobsForTrajectory(input.trajectoryId);
        const unsettledJobs = await this.cancellation.waitForSettled(cancelled, CANCELLED_JOB_SETTLE_TIMEOUT_MS);

        if (unsettledJobs > 0) {
            logger.warn({
                trajectoryId: input.trajectoryId,
                unsettledJobs,
                timeoutMs: CANCELLED_JOB_SETTLE_TIMEOUT_MS
            }, '@runtime-state-cleanup: cancelled jobs of a deleted trajectory are still running');
        }

        const deletedKeys = await this.stateStore.deleteKeys(this.distinctKeys([
            toParquetDrainClaimKey(input.trajectoryId),
            toAutoPreviewRasterClaimKey(input.trajectoryId),
            ...(input.analysisIds ?? []).map((analysisId) => this.analysisPendingJobsKey(analysisId)),
            ...this.removedAnalysisJobKeys(input.jobIds)
        ]));

        return {
            deletedKeys,
            removedJobs,
            cancelledJobs: cancelled.length,
            unsettledJobs
        };
    }

    private removedAnalysisJobKeys(jobIds: string[] | undefined): string[] {
        return (jobIds ?? []).map(toRemovedJobTombstoneKey);
    }

    private analysisPendingJobsKey(analysisId: string): string {
        return `analysis:${analysisId}:pending-jobs`;
    }

    private distinctKeys(keys: string[]): string[] {
        return [...new Set(keys)];
    }
}

export const getRuntimeStateCleanupControl = singleton((): RuntimeStateCleanupControl =>
    new RuntimeStateCleanupControl(getDaemonStateStore(), getQueueService(), getJobCancellationRegistry()));
