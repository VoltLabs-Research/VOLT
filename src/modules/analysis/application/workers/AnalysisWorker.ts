import { type Job as BullMQJob } from 'bullmq';

import { Service } from '@/core/decorators/service';
import { BaseWorker } from '@/core/queues/application/BaseWorker';
import { QueueService } from '@/core/queues/application/QueueService';
import { ANALYSIS_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import { AnalysisEnvironment } from '@/modules/analysis/application/workflow/AnalysisEnvironment';
import type { WorkflowRuntime } from '@/modules/analysis/application/workflow/WorkflowRuntime';
import type { AnalysisQueueJobPayload } from '@/modules/analysis/contracts/http-analysis';
import type { AnalysisDataStore } from '@/modules/analysis/infrastructure/storage/AnalysisDataStore';
import type { ArtifactUploadQueue } from '@/modules/plugin/application/artifacts/ArtifactUploadQueue';
import type { DaemonJobReporter } from '@/modules/jobs/application/reporting/DaemonJobReporter';
import { processAnalysisJob } from '@/modules/analysis/application/workers/processAnalysisJob';

@Service('analysisWorker')
export class AnalysisWorker extends BaseWorker<AnalysisQueueJobPayload> {
    protected readonly queueName = ANALYSIS_QUEUE_NAME;

    constructor(
        queueService: QueueService,
        private readonly analysisDataStore: AnalysisDataStore,
        private readonly analysisEnvironment: AnalysisEnvironment,
        private readonly artifactUploadQueue: ArtifactUploadQueue,
        private readonly daemonJobReporter: DaemonJobReporter,
        private readonly workflowRuntime: WorkflowRuntime
    ) {
        super({ queueService });
    }

    protected async process(payload: AnalysisQueueJobPayload, bullJob: BullMQJob<AnalysisQueueJobPayload>): Promise<void> {
        await processAnalysisJob(payload, {
            analysisDataStore: this.analysisDataStore,
            analysisEnvironment: this.analysisEnvironment,
            artifactUploadQueue: this.artifactUploadQueue,
            daemonJobReporter: this.daemonJobReporter,
            workflowRuntime: this.workflowRuntime
        }, {
            updateProgress: (value) => bullJob.updateProgress(value)
        });
    }
}
