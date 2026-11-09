import { singleton } from '@shared/utilities/singleton';
import { logger } from '@shared/logger';
import { getQueueService } from '@shared/queues/QueueService';
import { getDaemonStateStore } from '@shared/persistence/DaemonStateStore';
import type { QueueService } from '@shared/queues/QueueService';
import { stopProcess } from '@shared/runtime/process-tracker';
import { getJobCancellationRegistry, type JobCancellationRegistry } from '@shared/queues/job-cancellation';
import {
    listComputeStageAnalysisIds,
    parsePipelineStageJobId,
    toPipelineStageJobId,
    type PipelineStageJobRef
} from '@shared/queues/pipeline-stage-jobs';
import { REMOVED_JOB_TOMBSTONE_TTL_SECONDS, toRemovedJobTombstoneKey } from '@shared/persistence/daemon-state-keys';
import { PIPELINE_QUEUE_NAME } from '@core/constants/queue-names';
import type { DaemonStateStore } from '@shared/persistence/DaemonStateStore';
import type {
    JobsActionResponse,
    PipelineQueueJobPayload,
    RemoveRunningJobsRequest,
    RetryJobsRequest
} from '@shared/contracts/types/http-analysis';

// A pipeline reports each analysis stage of a frame as `<pipeline job>:<analysis id>`, and the queue
// holds only the pipeline job, which runs the frame's stages again.
const resolveQueueJobId = (jobId: string): string =>
    parsePipelineStageJobId(jobId)?.pipelineJobId ?? jobId;

export class JobControl {
    constructor(
        private readonly queueService: QueueService,
        private readonly stateStore: DaemonStateStore,
        private readonly cancellation: JobCancellationRegistry
    ) {}

    retryJobs = async (input: RetryJobsRequest): Promise<JobsActionResponse> => {
        const affectedJobIds: string[] = [];
        const retriedQueueJobIds = new Set<string>();

        for (const jobId of input.jobIds) {
            const queueJobId = resolveQueueJobId(jobId);
            if (!retriedQueueJobIds.has(queueJobId)) {
                const retried = await this.queueService.retryJobById(queueJobId);
                if (!retried) {
                    continue;
                }
                retriedQueueJobIds.add(queueJobId);
            }
            affectedJobIds.push(jobId);
        }

        return {
            affectedJobs: affectedJobIds.length,
            affectedJobIds
        };
    };

    removeRunningJobs = async (input: RemoveRunningJobsRequest): Promise<JobsActionResponse> => {
        const affectedJobIds: string[] = [];

        for (const jobId of input.jobIds) {
            await this.stateStore.setValueWithTtl(
                toRemovedJobTombstoneKey(jobId),
                '1',
                REMOVED_JOB_TOMBSTONE_TTL_SECONDS
            );

            const stage = parsePipelineStageJobId(jobId);
            const removed = stage
                ? await this.removePipelineStage(stage)
                : await this.removeQueueJob(jobId);

            if (removed) {
                affectedJobIds.push(jobId);
            }
        }

        return {
            affectedJobs: affectedJobIds.length,
            affectedJobIds
        };
    };

    private async removeQueueJob(jobId: string): Promise<boolean> {
        stopProcess(jobId);
        this.cancellation.cancelJob(jobId);

        try {
            return await this.queueService.removeJobById(jobId);
        } catch (error) {
            logger.error({
                err: error,
                jobId
            }, 'Failed to remove running job from queue');
            return false;
        }
    }

    // Later stages of a pipeline read the working dump earlier stages leave behind, so one removed
    // stage cannot stop the pipeline job on its own: the worker drops that stage's results instead.
    // Only once every analysis stage is removed is the pipeline job itself cancelled.
    private async removePipelineStage(stage: PipelineStageJobRef): Promise<boolean> {
        let pipeline: PipelineQueueJobPayload | null;
        try {
            pipeline = await this.queueService.findLivePayload<PipelineQueueJobPayload>(
                PIPELINE_QUEUE_NAME,
                stage.pipelineJobId
            );
        } catch (error) {
            logger.error({
                err: error,
                jobId: stage.pipelineJobId
            }, 'Failed to look up pipeline job for stage removal');
            return false;
        }

        if (!pipeline) return false;

        const analysisIds = listComputeStageAnalysisIds(pipeline.stages);
        if (!analysisIds.includes(stage.analysisId)) return false;

        const tombstones = await Promise.all(analysisIds.map((analysisId) =>
            this.stateStore.getValue(toRemovedJobTombstoneKey(toPipelineStageJobId(stage.pipelineJobId, analysisId)))));

        if (tombstones.every((value) => value === '1')) {
            await this.removeQueueJob(stage.pipelineJobId);
        }

        return true;
    }
}

export const getJobControl = singleton((): JobControl =>
    new JobControl(getQueueService(), getDaemonStateStore(), getJobCancellationRegistry()));
