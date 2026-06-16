import { type Job as BullMQJob } from 'bullmq';

import { Service } from '@/core/decorators/service';
import { BaseWorker } from '@/core/queues/application/BaseWorker';
import { QueueService } from '@/core/queues/application/QueueService';
import type { QueueScopeKey, QueueScopeLimitsRegistry } from '@/core/queues/application/QueueScopeLimitsRegistry';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { PIPELINE_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import { AnalysisEnvironment } from '@/modules/analysis/application/workflow/AnalysisEnvironment';
import type { WorkflowRuntime } from '@/modules/analysis/application/workflow/WorkflowRuntime';
import type { DumpTransformService } from '@/modules/analysis/application/analysis/dump-transform';
import type { PipelineSharedExposureStore } from '@/modules/analysis/application/analysis/PipelineSharedExposureStore';
import type { PipelineQueueJobPayload } from '@/modules/analysis/contracts/http-analysis';
import type { AnalysisDataStore } from '@/modules/analysis/infrastructure/storage/AnalysisDataStore';
import type { ArtifactUploadQueue } from '@/modules/plugin/application/artifacts/ArtifactUploadQueue';
import type { DaemonJobReporter } from '@/modules/jobs/application/reporting/DaemonJobReporter';
import { processPipelineJob } from '@/modules/analysis/application/workers/processPipelineJob';

@Service('pipelineWorker')
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
