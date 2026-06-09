import { ProgressStageType } from '@voltstack/daemon-cluster-client';
import { Service } from '@/core/decorators/service';
import { OrchestrationAction } from '@/core/runtime/contracts/http-runtime';
import { ANALYSIS_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import { serializeDaemonTraceContext } from '@/core/observability/infrastructure/daemon-instrumentation';
import { compressSerializedAnalysisExecutionData, serializeAnalysisExecutionData } from '@/support/policies/analysis-execution-data';
import { WorkflowEngine } from '@/modules/analysis/application/workflow/WorkflowEngine';
import { RuntimeEventBroker } from '@/core/reverse-channel/application/RuntimeEventBroker';
import type { AnalysisQueueAdmissionController } from '@/modules/analysis/application/analysis/AnalysisQueueAdmissionController';
import { planAnalysisWorkflow } from '@/modules/analysis/application/analysis/plan-analysis-workflow';
import type {
    AnalysisStartRequestWithTrace,
    AnalysisStartResponse,
    QueuedJobNotification
} from '@/modules/analysis/contracts/http-analysis';
import type { AnalysisDataStore } from '@/modules/analysis/infrastructure/storage/AnalysisDataStore';

@Service('analysisDispatcher')
export class AnalysisDispatcher {
    constructor(
        private readonly workflowEngine: WorkflowEngine,
        private readonly analysisDataStore: AnalysisDataStore,
        private readonly eventBroker: RuntimeEventBroker,
        private readonly analysisQueueAdmissionController: AnalysisQueueAdmissionController
    ) {}

    async startAnalysis(input: AnalysisStartRequestWithTrace): Promise<AnalysisStartResponse> {
        const serializedTraceContext = serializeDaemonTraceContext(input.traceContext);

        this.eventBroker.emitProgress({
            action: OrchestrationAction.AnalysisStart,
            stage: ProgressStageType.Accepted,
            timestamp: new Date().toISOString(),
            payload: {
                analysisId: input.analysisId,
                traceContext: serializedTraceContext
            }
        });

        const { executionData, jobs } = await planAnalysisWorkflow({
            input,
            workflowEngine: this.workflowEngine,
            serializedTraceContext
        });

        const serializedExecutionData = serializeAnalysisExecutionData(executionData);
        const executionDataCompressed = await compressSerializedAnalysisExecutionData(serializedExecutionData);
        const executionDataReference = await this.analysisDataStore.store(executionData, {
            serializedPayload: serializedExecutionData,
            compressedPayload: executionDataCompressed
        });
        const queuedPayloads = jobs.map((job) => ({
            ...job,
            executionDataReference
        }));

        const admission = await this.analysisQueueAdmissionController.enqueueInitialJobs(queuedPayloads);

        this.eventBroker.emitProgress({
            action: OrchestrationAction.AnalysisStart,
            stage: ProgressStageType.Queued,
            timestamp: new Date().toISOString(),
            payload: {
                analysisId: input.analysisId,
                totalJobs: jobs.length,
                queuedNow: admission.queuedJobs.length,
                deferredJobs: admission.deferredJobs,
                traceContext: serializedTraceContext
            }
        });

        return {
            queued: true,
            totalJobs: jobs.length,
            jobs: admission.queuedJobs.map((job): QueuedJobNotification => ({
                jobId: job.jobId,
                name: job.name,
                teamId: job.teamId,
                timestep: job.timestep,
                trajectoryId: input.trajectoryId,
                analysisId: input.analysisId,
                queueType: ANALYSIS_QUEUE_NAME
            }))
        };
    }
}
