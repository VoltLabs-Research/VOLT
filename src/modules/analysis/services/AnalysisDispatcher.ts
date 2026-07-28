import { getAnalysisDataStore } from '@modules/analysis/services/AnalysisDataStore';
import { getAnalysisQueueAdmissionController } from '@modules/analysis/services/AnalysisQueueAdmissionController';
import { ProgressStageType } from '@voltstack/daemon-cluster-client';
import { OrchestrationAction } from '@shared/contracts/types/http-runtime';
import { ANALYSIS_QUEUE_NAME } from '@core/constants/queue-names';
import { serializeDaemonTraceContext } from '@shared/infrastructure/observability/daemon-instrumentation';
import { compressSerializedAnalysisExecutionData, serializeAnalysisExecutionData } from '@shared/domain/utilities/analysis-execution-data';
import { WorkflowEngine, getWorkflowEngine } from '@modules/analysis/services/workflow/WorkflowEngine';
import { RuntimeEventBroker, getEventBroker } from '@shared/application/events/RuntimeEventBroker';
import type { AnalysisQueueAdmissionController } from '@modules/analysis/services/AnalysisQueueAdmissionController';
import { planAnalysisWorkflow } from '@modules/analysis/services/plan-analysis-workflow';
import type {
    AnalysisStartRequestWithTrace,
    AnalysisStartResponse,
    QueuedJobNotification
} from '@shared/contracts/types/http-analysis';
import type { AnalysisDataStore } from '@modules/analysis/services/AnalysisDataStore';

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

let analysisDispatcherInstance: AnalysisDispatcher | null = null;

export const getAnalysisDispatcher = (): AnalysisDispatcher => {
    analysisDispatcherInstance ??= new AnalysisDispatcher(getWorkflowEngine(), getAnalysisDataStore(), getEventBroker(), getAnalysisQueueAdmissionController());
    return analysisDispatcherInstance;
};
