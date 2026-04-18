import { ProgressStageType } from '@voltstack/daemon-cluster-client';
import { logger } from '@/core/logger';
import { DaemonCommandError } from '@/core/reverse-channel/application/DaemonCommandError';
import { OrchestrationAction, EntrypointType } from '@/core/runtime/contracts/http-runtime';
import { ANALYSIS_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import { QueueService } from '@/core/queues/application/QueueService';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import { createTraceLogContext, serializeDaemonTraceContext } from '@/core/observability/infrastructure/daemon-instrumentation';
import { compressSerializedAnalysisExecutionData, serializeAnalysisExecutionData } from '@/support/policies/analysis-execution-data';
import { WorkflowEngine } from '@/modules/analysis/application/workflow/WorkflowEngine';
import { WorkflowSession } from '@/modules/analysis/application/workflow/WorkflowSession';
import { RuntimeEventBroker } from '@/core/reverse-channel/application/RuntimeEventBroker';
import { buildBatchAnalysisJob, buildItemAnalysisJob } from '@/modules/analysis/domain/jobs/analysis-job-factory';
import type {
    AnalysisExecutionDataReference,
    AnalysisJobExecutionData,
    AnalysisQueueJobPayload,
    AnalysisStartRequest,
    AnalysisStartResponse,
    PlannedExecutionItem,
    QueuedJobNotification
} from '@/modules/analysis/contracts/http-analysis';
import type { AnalysisDataStore } from '@/modules/analysis/infrastructure/storage/AnalysisDataStore';
import type { DaemonTraceContext } from '@/core/observability/infrastructure/daemon-instrumentation';

interface StoredExecutionDataResult {
    executionDataCompressed?: string;
    executionDataReference?: AnalysisExecutionDataReference;
}

interface AnalysisStartRequestWithTrace extends AnalysisStartRequest {
    traceContext?: DaemonTraceContext;
}

export class AnalysisDispatcher {
    constructor(
        private readonly workflowEngine: WorkflowEngine,
        private readonly queueService: QueueService,
        private readonly analysisDataStore: AnalysisDataStore,
        private readonly eventBroker: RuntimeEventBroker
    ) {}

    async startAnalysis(input: AnalysisStartRequestWithTrace): Promise<AnalysisStartResponse> {
        const startedAt = Date.now();
        const serializedTraceContext = serializeDaemonTraceContext(input.traceContext);
        const workflow = input.workflow;
        const entrypoint = workflow.nodes.find((node) => node.type === WorkflowNodeType.Entrypoint)?.data.entrypoint;

        if (!entrypoint?.binaryObjectPath || !entrypoint.arguments) {
            throw DaemonCommandError.badRequest(
                'Analysis::Start::InvalidEntrypoint',
                'Daemon workflow entrypoint is invalid'
            );
        }

        this.eventBroker.emitProgress({
            action: OrchestrationAction.AnalysisStart,
            stage: ProgressStageType.Accepted,
            timestamp: new Date().toISOString(),
            payload: {
                analysisId: input.analysisId,
                traceContext: serializedTraceContext
            }
        });

        const plan = await this.workflowEngine.planExecutionStrategy({
            workflow: input.workflow,
            nestedPlugins: input.nestedPlugins,
            trajectoryId: input.trajectoryId,
            trajectoryFrames: input.trajectoryFrames,
            analysis: input.analysis,
            analysisId: input.analysisId,
            pluginId: input.pluginId,
            userConfig: input.config,
            teamId: input.teamId,
            options: {
                selectedFrameOnly: input.selectedFrameOnly,
                selectedTimesteps: input.selectedTimesteps,
                timestep: input.timestep
            }
        });

        if (!plan || plan.items.length === 0) {
            throw DaemonCommandError.unprocessableEntity(
                'Analysis::Start::EmptyExecutionPlan',
                'No items after daemon workflow planning'
            );
        }

        const isBatchMode = plan.batchMode === true;
        const plannedItems = plan.items as PlannedExecutionItem[];

        const factoryContext = {
            input,
            serializedTraceContext,
            totalItems: plannedItems.length
        };
        const jobs: AnalysisQueueJobPayload[] = isBatchMode
            ? [buildBatchAnalysisJob(factoryContext)]
            : plannedItems.map((item, index) => {
                const timestep = item.timestep ?? item.frame;
                if (typeof timestep !== 'number') {
                    throw DaemonCommandError.unprocessableEntity(
                        'Analysis::Start::MissingTimestep',
                        `Missing timestep for analysis job ${input.analysisId}-${index}`
                    );
                }

                return buildItemAnalysisJob(factoryContext, item, index, timestep);
            });

        const executionData: AnalysisJobExecutionData = {
            entrypoint: {
                binaryObjectPath: entrypoint.binaryObjectPath,
                arguments: entrypoint.arguments,
                type: entrypoint.type ?? EntrypointType.Executable,
                timeout: entrypoint.timeout,
                requirementsFile: entrypoint.requirementsFile,
                entrypointScript: entrypoint.entrypointScript
            },
            identity: {
                pluginId: input.pluginId,
                trajectoryId: input.trajectoryId,
                analysisId: input.analysisId,
                teamId: input.teamId,
                computeClusterId: input.teamClusterId,
                storageClusterId: input.analysis.storageClusterId
            },
            workflow: {
                definition: workflow,
                nestedPlugins: input.nestedPlugins,
                pluginReferenceExecutions: input.pluginReferenceExecutions,
                exposures: WorkflowSession.collectExposureDefinitions(workflow),
                forEachNodeId: plan.forEachNodeId,
                nodeOutputSnapshots: plan.nodeOutputSnapshots
            },
            trajectoryFrames: input.trajectoryFrames,
            batch: plan.batchMode
                ? {
                    trajectoryDumps: plan.batchTrajectoryDumps ?? [],
                    contextNodeId: plan.contextNodeId
                }
                : undefined,
            traceContext: serializedTraceContext
        };

        const queuePayloadBytesBefore = Buffer.byteLength(JSON.stringify({
            ...jobs[0],
            executionData
        }));
        let storedExecutionData: StoredExecutionDataResult = {};

        try {
            const serializedExecutionData = serializeAnalysisExecutionData(executionData);
            const executionDataCompressed = compressSerializedAnalysisExecutionData(serializedExecutionData);
            const executionDataReference = await this.analysisDataStore.store(executionData, {
                serializedPayload: serializedExecutionData,
                compressedPayload: executionDataCompressed
            });

            storedExecutionData = {
                executionDataCompressed,
                executionDataReference
            };
        } catch (error) {
            logger.warn(
                {
                    analysisId: input.analysisId,
                    err: error,
                    ...createTraceLogContext(input.traceContext)
                },
                'Failed to store shared analysis execution data reference; falling back to inline payloads'
            );
        }

        const { executionDataCompressed, executionDataReference } = storedExecutionData;

        const queuePayloadBytesAfter = executionDataReference
            ? Buffer.byteLength(JSON.stringify({
                ...jobs[0],
                executionDataCompressed,
                executionDataReference
            }))
            : queuePayloadBytesBefore;

        const queuedPayloads = jobs.map((job) => executionDataReference
            ? { ...job, executionDataCompressed, executionDataReference }
            : { ...job, executionData });

        await this.queueService.enqueueBulk(ANALYSIS_QUEUE_NAME, queuedPayloads);

        this.eventBroker.emitProgress({
            action: OrchestrationAction.AnalysisStart,
            stage: ProgressStageType.Queued,
            timestamp: new Date().toISOString(),
            payload: {
                analysisId: input.analysisId,
                totalJobs: jobs.length,
                traceContext: serializedTraceContext
            }
        });

        return {
            queued: true,
            totalJobs: jobs.length,
            jobs: jobs.map((job): QueuedJobNotification => ({
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
