import { singleton } from '@shared/application/utilities/singleton';
import { defineDaemonWorker } from '@shared/infrastructure/queues/worker-registry';
import { getQueueScopeLimitsRegistry } from '@shared/infrastructure/queues/QueueScopeLimitsRegistry';
import { getAnalysisDataStore } from '@modules/analysis/services/AnalysisDataStore';
import { getArtifactUploadQueue } from '@modules/plugin/services/artifacts/ArtifactUploadQueue';
import { getDaemonJobReporter } from '@modules/jobs/services/DaemonJobReporter';
import { getWorkflowRuntime } from '@modules/analysis/services/workflow/WorkflowRuntime';
import { getAnalysisQueueAdmissionController } from '@modules/analysis/services/AnalysisQueueAdmissionController';
import { getAnalysisProvenanceCollector } from '@modules/analysis/services/AnalysisProvenanceCollector';
import type { QueueJobHandle } from '@shared/infrastructure/queues/queue-job-handle';

import { BaseWorker } from '@shared/infrastructure/queues/BaseWorker';
import { QueueService, getQueueService } from '@shared/infrastructure/queues/QueueService';
import type { QueueScopeKey, QueueScopeLimitsRegistry } from '@shared/infrastructure/queues/QueueScopeLimitsRegistry';
import { ANALYSIS_QUEUE_NAME } from '@core/constants/queue-names';
import type { AnalysisQueueAdmissionController } from '@modules/analysis/services/AnalysisQueueAdmissionController';
import { AnalysisEnvironment, getAnalysisEnvironment } from '@modules/analysis/services/workflow/AnalysisEnvironment';
import type { WorkflowRuntime } from '@modules/analysis/services/workflow/WorkflowRuntime';
import type { AnalysisQueueJobPayload } from '@shared/contracts/types/http-analysis';
import type { AnalysisDataStore } from '@modules/analysis/services/AnalysisDataStore';
import type { ArtifactUploadQueue } from '@modules/plugin/services/artifacts/ArtifactUploadQueue';
import type { DaemonJobReporter } from '@modules/jobs/services/DaemonJobReporter';
import { processAnalysisJob } from '@modules/analysis/workers/process-analysis-job';
import type { AnalysisProvenanceCollector } from '@modules/analysis/services/AnalysisProvenanceCollector';

export class AnalysisWorker extends BaseWorker<AnalysisQueueJobPayload> {
    protected readonly queueName = ANALYSIS_QUEUE_NAME;
    protected readonly scopeKey: QueueScopeKey = 'analysisProcessing';

    constructor(
        queueService: QueueService,
        queueScopeLimitsRegistry: QueueScopeLimitsRegistry,
        private readonly analysisDataStore: AnalysisDataStore,
        private readonly analysisEnvironment: AnalysisEnvironment,
        private readonly artifactUploadQueue: ArtifactUploadQueue,
        private readonly daemonJobReporter: DaemonJobReporter,
        private readonly workflowRuntime: WorkflowRuntime,
        private readonly analysisQueueAdmissionController: AnalysisQueueAdmissionController,
        private readonly analysisProvenanceCollector: AnalysisProvenanceCollector
    ) {
        super({
            queueService,
            scopeLimitsRegistry: queueScopeLimitsRegistry
        });
    }

    protected async process(payload: AnalysisQueueJobPayload, job: QueueJobHandle<AnalysisQueueJobPayload>): Promise<void> {
        await processAnalysisJob(payload, {
            analysisDataStore: this.analysisDataStore,
            analysisEnvironment: this.analysisEnvironment,
            artifactUploadQueue: this.artifactUploadQueue,
            daemonJobReporter: this.daemonJobReporter,
            workflowRuntime: this.workflowRuntime,
            analysisQueueAdmissionController: this.analysisQueueAdmissionController,
            analysisProvenanceCollector: this.analysisProvenanceCollector
        });
    }
}

export const analysisWorker = defineDaemonWorker({
    name: 'analysis',
    scope: 'compute',
    concurrencyKey: 'analysis',
    tracksConcurrencyWhileRunning: true
}, singleton((): AnalysisWorker => new AnalysisWorker(getQueueService(), getQueueScopeLimitsRegistry(), getAnalysisDataStore(), getAnalysisEnvironment(), getArtifactUploadQueue(), getDaemonJobReporter(), getWorkflowRuntime(), getAnalysisQueueAdmissionController(), getAnalysisProvenanceCollector())));
