import { logger } from '@/core/logger';
import { DaemonCommandError } from '@/core/reverse-channel/application/DaemonCommandError';
import { OrchestrationAction, EntrypointType } from '@/core/runtime/contracts/http.runtime';
import { ANALYSIS_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import { QueueService } from '@/core/queues/application/QueueService';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import { createTraceLogContext, serializeDaemonTraceContext } from '@/core/observability/infrastructure/daemonInstrumentation';
import { compressSerializedAnalysisExecutionData, serializeAnalysisExecutionData } from '@/support/policies/analysis-execution-data';
import { collectWorkflowExposureDefinitions } from '@/modules/analysis/application/workflow/ExposureExportLinking';
import { WorkflowEngine } from '@/modules/analysis/application/workflow/WorkflowEngine';
import { RuntimeEventBroker } from '@/core/reverse-channel/application/RuntimeEventBroker';

type AnalysisExecutionDataReference = import('@/modules/analysis/contracts/http.analysis').AnalysisExecutionDataReference;
type AnalysisJobExecutionData = import('@/modules/analysis/contracts/http.analysis').AnalysisJobExecutionData;
type AnalysisQueueJobPayload = import('@/modules/analysis/contracts/http.analysis').AnalysisQueueJobPayload;
type AnalysisStartRequest = import('@/modules/analysis/contracts/http.analysis').AnalysisStartRequest;
type AnalysisStartResponse = import('@/modules/analysis/contracts/http.analysis').AnalysisStartResponse;
type QueuedJobNotification = import('@/modules/analysis/contracts/http.analysis').QueuedJobNotification;
type AnalysisExecutionDataStore = import('@/modules/analysis/infrastructure/storage/AnalysisExecutionDataStore').AnalysisExecutionDataStore;
type DaemonTraceContext = import('@/core/observability/infrastructure/daemonInstrumentation').DaemonTraceContext;
type RuntimeProgressStage = import('@/core/runtime/events/RuntimeProgressEvent').RuntimeProgressEventData['stage'];
type AnalysisConfig = AnalysisStartRequest['config'];
type SerializedTraceContext = NonNullable<AnalysisJobExecutionData['traceContext']>;

interface PlannedExecutionItem {
    timestep?: number;
    path?: string;
    frame?: number;
}

interface AnalysisJobMetadata {
    trajectoryId: string;
    analysisId: string;
    name: string;
    config: AnalysisConfig;
    plugin: string;
    totalItems: number;
    traceContext?: SerializedTraceContext;
    batchMode?: true;
    inputFile?: string;
    timestep?: number;
    itemIndex?: number;
    forEachItem?: PlannedExecutionItem;
    forEachIndex?: number;
}

interface StoredExecutionDataResult {
    executionDataCompressed?: string;
    executionDataReference?: AnalysisExecutionDataReference;
}

interface AnalysisStartRequestWithTrace extends AnalysisStartRequest {
    traceContext?: DaemonTraceContext;
};

function createProgressStage(stage: RuntimeProgressStage): RuntimeProgressStage {
    return stage;
}

export class AnalysisDispatchService {
    constructor(
        private readonly workflowEngine: WorkflowEngine,
        private readonly queueService: QueueService,
        private readonly analysisExecutionDataStore: AnalysisExecutionDataStore,
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
            stage: createProgressStage('accepted'),
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

        logger.info(
            {
                analysisId: input.analysisId,
                batchMode: plan.batchMode === true,
                plannedItems: plan.items.length,
                ...createTraceLogContext(input.traceContext)
            },
            'Planned daemon analysis dispatch'
        );

        const isBatchMode = plan.batchMode === true;
        const plannedItems = plan.items as PlannedExecutionItem[];
        const queuedAt = new Date().toISOString();
        const jobs: AnalysisQueueJobPayload[] = isBatchMode
            ? [{
                jobId: `${input.analysisId}-batch-0`,
                name: input.pluginDisplayName,
                teamId: input.teamId,
                status: 'queued',
                queueType: ANALYSIS_QUEUE_NAME,
                metadata: {
                    trajectoryId: input.trajectoryId,
                    analysisId: input.analysisId,
                    name: input.pluginDisplayName,
                    config: input.config,
                    plugin: input.pluginId,
                    totalItems: plannedItems.length,
                    batchMode: true,
                    traceContext: serializedTraceContext
                } satisfies AnalysisJobMetadata,
                createdAt: queuedAt,
                updatedAt: queuedAt
            }]
            : plannedItems.map((item, index) => {
                const timestep = item.timestep ?? item.frame;
                if (typeof timestep !== 'number') {
                    throw DaemonCommandError.unprocessableEntity(
                        'Analysis::Start::MissingTimestep',
                        `Missing timestep for analysis job ${input.analysisId}-${index}`
                    );
                }

                return {
                    jobId: `${input.analysisId}-${index}`,
                    name: input.pluginDisplayName,
                    teamId: input.teamId,
                    timestep,
                    status: 'queued',
                    queueType: ANALYSIS_QUEUE_NAME,
                    metadata: {
                        trajectoryId: input.trajectoryId,
                        analysisId: input.analysisId,
                        name: input.pluginDisplayName,
                        config: input.config,
                        inputFile: item.path ?? `trajectory-${input.trajectoryId}/timestep-${String(timestep)}.dump.zst`,
                        timestep,
                        plugin: input.pluginId,
                        totalItems: plannedItems.length,
                        itemIndex: index,
                        forEachItem: item,
                        forEachIndex: index,
                        traceContext: serializedTraceContext
                    } satisfies AnalysisJobMetadata,
                    createdAt: queuedAt,
                    updatedAt: queuedAt
                };
            });
        const executionData: AnalysisJobExecutionData = {
            binaryObjectPath: entrypoint.binaryObjectPath,
            entrypointType: entrypoint.type ?? EntrypointType.Executable,
            arguments: entrypoint.arguments,
            timeoutMs: entrypoint.timeout,
            requirementsFile: entrypoint.requirementsFile,
            entrypointScript: entrypoint.entrypointScript,
            pluginId: input.pluginId,
            trajectoryId: input.trajectoryId,
            analysisId: input.analysisId,
            teamId: input.teamId,
            trajectoryFrames: input.trajectoryFrames,
            computeClusterId: input.teamClusterId,
            storageClusterId: input.analysis.storageClusterId,
            exposures: collectWorkflowExposureDefinitions(workflow),
            forEachNodeId: plan.forEachNodeId,
            nodeOutputSnapshots: plan.nodeOutputSnapshots,
            workflow,
            nestedPlugins: input.nestedPlugins,
            pluginReferenceExecutions: input.pluginReferenceExecutions,
            ...(serializedTraceContext ? { traceContext: serializedTraceContext } : {}),
            ...(isBatchMode ? {
                batchMode: true,
                batchTrajectoryDumps: plan.batchTrajectoryDumps,
                allDumpUrls: plan.batchTrajectoryDumps?.map((dump) => dump.path),
                contextNodeId: plan.contextNodeId
            } : {})
        };

        const queuePayloadBytesBefore = Buffer.byteLength(JSON.stringify({
            ...jobs[0],
            executionData
        }));
        let storedExecutionData: StoredExecutionDataResult = {};

        try {
            const serializedExecutionData = serializeAnalysisExecutionData(executionData);
            const executionDataCompressed = compressSerializedAnalysisExecutionData(serializedExecutionData);
            const executionDataReference = await this.analysisExecutionDataStore.store(executionData, {
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

        logger.info(
            {
                analysisId: input.analysisId,
                payloadBytesAfter: queuePayloadBytesAfter,
                payloadBytesBefore: queuePayloadBytesBefore,
                payloadBytesSavedPerJob: queuePayloadBytesBefore - queuePayloadBytesAfter,
                referenceStored: typeof executionDataReference !== 'undefined',
                ...createTraceLogContext(input.traceContext)
            },
            'Prepared daemon analysis queue payload optimization'
        );

        const queuedPayloads = jobs.map((job) => executionDataReference
            ? {
                ...job,
                executionDataCompressed,
                executionDataReference
            }
            : {
                ...job,
                executionData
            });

        await this.queueService.enqueueBulk(ANALYSIS_QUEUE_NAME, queuedPayloads);

        this.eventBroker.emitProgress({
            action: OrchestrationAction.AnalysisStart,
            stage: createProgressStage('queued'),
            timestamp: new Date().toISOString(),
            payload: {
                analysisId: input.analysisId,
                totalJobs: jobs.length,
                traceContext: serializedTraceContext
            }
        });

        logger.info(
            {
                analysisId: input.analysisId,
                durationMs: Date.now() - startedAt,
                queuedJobs: jobs.length,
                ...createTraceLogContext(input.traceContext)
            },
            'Queued daemon analysis jobs'
        );

        return {
            queued: true,
            totalJobs: jobs.length,
            jobs: jobs.map((job): QueuedJobNotification => ({
                jobId: job.jobId,
                name: job.name,
                teamId: job.teamId,
                timestep: job.timestep,
                trajectoryId: input.trajectoryId,
                trajectoryName: input.trajectoryName,
                analysisId: input.analysisId,
                queueType: ANALYSIS_QUEUE_NAME
            }))
        };
    }
}
