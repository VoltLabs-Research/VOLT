import { getQueueScopeLimitsRegistry } from '@shared/infrastructure/queues/QueueScopeLimitsRegistry';
import { getAnalysisDataStore } from '@modules/analysis/services/AnalysisDataStore';
import { getArtifactUploadQueue } from '@modules/plugin/services/artifacts/ArtifactUploadQueue';
import { getDaemonJobReporter } from '@modules/jobs/services/DaemonJobReporter';
import { getWorkflowRuntime } from '@modules/analysis/services/workflow/WorkflowRuntime';
import { getDumpTransformService } from '@modules/analysis/services/dump-transform';
import { getPipelineSharedExposureStore } from '@modules/analysis/services/PipelineSharedExposureStore';
import { getObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { type Job as BullMQJob } from 'bullmq';

import { BaseWorker } from '@shared/infrastructure/queues/BaseWorker';
import { QueueService, getQueueService } from '@shared/infrastructure/queues/QueueService';
import type { QueueScopeKey, QueueScopeLimitsRegistry } from '@shared/infrastructure/queues/QueueScopeLimitsRegistry';
import type { ClusterObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { PIPELINE_QUEUE_NAME } from '@core/constants/queue-names';
import { AnalysisEnvironment, getAnalysisEnvironment } from '@modules/analysis/services/workflow/AnalysisEnvironment';
import type { WorkflowRuntime } from '@modules/analysis/services/workflow/WorkflowRuntime';
import type { DumpTransformService } from '@modules/analysis/services/dump-transform';
import type { PipelineSharedExposureStore } from '@modules/analysis/services/PipelineSharedExposureStore';
import type { PipelineQueueJobPayload } from '@shared/contracts/types/http-analysis';
import type { AnalysisDataStore } from '@modules/analysis/services/AnalysisDataStore';
import type { ArtifactUploadQueue } from '@modules/plugin/services/artifacts/ArtifactUploadQueue';
import type { DaemonJobReporter } from '@modules/jobs/services/DaemonJobReporter';
import { processPipelineJob } from '@modules/analysis/workers/processPipelineJob';

export class PipelineWorker extends BaseWorker<PipelineQueueJobPayload> {
    protected readonly queueName = PIPELINE_QUEUE_NAME;
    protected readonly scopeKey: QueueScopeKey = 'analysisProcessing';

    constructor(
        queueService: QueueService,
        queueScopeLimitsRegistry: QueueScopeLimitsRegistry,
        private readonly analysisDataStore: AnalysisDataStore,
        private readonly analysisEnvironment: AnalysisEnvironment,
        private readonly artifactUploadQueue: ArtifactUploadQueue,
        private readonly daemonJobReporter: DaemonJobReporter,
        private readonly workflowRuntime: WorkflowRuntime,
        private readonly dumpTransformService: DumpTransformService,
        private readonly pipelineSharedExposureStore: PipelineSharedExposureStore,
        private readonly objectStore: ClusterObjectStore
    ) {
        super({ queueService, scopeLimitsRegistry: queueScopeLimitsRegistry });
    }

    protected async process(payload: PipelineQueueJobPayload, bullJob: BullMQJob<PipelineQueueJobPayload>): Promise<void> {
        await processPipelineJob(payload, {
            analysisDataStore: this.analysisDataStore,
            analysisEnvironment: this.analysisEnvironment,
            artifactUploadQueue: this.artifactUploadQueue,
            daemonJobReporter: this.daemonJobReporter,
            workflowRuntime: this.workflowRuntime,
            dumpTransformService: this.dumpTransformService,
            pipelineSharedExposureStore: this.pipelineSharedExposureStore,
            objectStore: this.objectStore
        }, {
            updateProgress: (value) => bullJob.updateProgress(value)
        });
    }
}

let pipelineWorkerInstance: PipelineWorker | null = null;

export const getPipelineWorker = (): PipelineWorker => {
    pipelineWorkerInstance ??= new PipelineWorker(getQueueService(), getQueueScopeLimitsRegistry(), getAnalysisDataStore(), getAnalysisEnvironment(), getArtifactUploadQueue(), getDaemonJobReporter(), getWorkflowRuntime(), getDumpTransformService(), getPipelineSharedExposureStore(), getObjectStore());
    return pipelineWorkerInstance;
};
