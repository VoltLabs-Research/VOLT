import { logger } from '@/core/logger';
import { DaemonCommandError } from '@/modules/cloud-control/services/DaemonCommandError';
import { ANALYSIS_QUEUE_NAME, QueueService } from '@/modules/platform/services';
import { readWorkflowEntrypointData } from '@/modules/workflow-runtime/services/InlineWorkflowShared';
import { createTraceLogContext, serializeDaemonTraceContext } from '@/shared/observability/daemonInstrumentation';
import {
    compressSerializedAnalysisExecutionData,
    serializeAnalysisExecutionData
} from '@/shared/utilities/analysis-execution-data';
import { WorkflowEngine } from '@/modules/workflow-runtime/services';
import { EntrypointType, OrchestrationAction } from '@/shared/contracts';
import { RuntimeEventBroker } from '@/shared/services';
import { ProgressStageType } from '@voltstack/daemon-cluster-client';
import type { AnalysisExecutionDataStore } from '@/modules/platform/services';
import type {
    AnalysisExecutionDataReference,
    AnalysisJobExecutionData,
    AnalysisQueueJobPayload,
    AnalysisStartRequest,
    AnalysisStartResponse,
    QueuedJobNotification,
    TrajectoryDumpDescriptor
} from '@/shared/contracts';
import type { DaemonTraceContext } from '@/shared/observability/daemonInstrumentation';

interface AnalysisStartRequestWithTrace extends AnalysisStartRequest {
    traceContext?: DaemonTraceContext;
};

type PlannedExecutionItem = Record<string, unknown> | TrajectoryDumpDescriptor;

const measurePayloadBytes = (payload: Record<string, unknown>): number => {
    return Buffer.byteLength(JSON.stringify(payload));
};

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
        const jobs = isBatchMode
            ? this.buildBatchJob(input, plan.items)
            : this.buildJobs(input, plan.items);

        const batchTrajectoryDumps = isBatchMode ? plan.batchTrajectoryDumps : undefined;
        const allDumpUrls = batchTrajectoryDumps?.map((dump) => dump.path);

        const executionData: AnalysisJobExecutionData = {
            ...this.resolveEntrypoint(input.workflow),
            pluginId: input.pluginId,
            trajectoryId: input.trajectoryId,
            analysisId: input.analysisId,
            teamId: input.teamId,
            trajectoryFrames: input.trajectoryFrames,
            computeClusterId: input.teamClusterId,
            storageClusterId: input.analysis.storageClusterId,
            exposures: this.collectExposures(input.workflow),
            forEachNodeId: plan.forEachNodeId,
            nodeOutputSnapshots: plan.nodeOutputSnapshots,
            workflow: input.workflow,
            nestedPlugins: input.nestedPlugins,
            pluginReferenceExecutions: input.pluginReferenceExecutions,
            ...(serializedTraceContext ? { traceContext: serializedTraceContext } : {}),
            ...(isBatchMode ? {
                batchMode: true,
                batchTrajectoryDumps,
                allDumpUrls,
                contextNodeId: plan.contextNodeId
            } : {})
        };

        const queuePayloadBytesBefore = measurePayloadBytes({
            ...jobs[0],
            executionData
        });
        let executionDataReference: AnalysisExecutionDataReference | undefined;
        let executionDataCompressed: string | undefined;

        try {
            const serializedExecutionData = serializeAnalysisExecutionData(executionData);
            executionDataCompressed = compressSerializedAnalysisExecutionData(serializedExecutionData);
            executionDataReference = await this.analysisExecutionDataStore.store(executionData, {
                serializedPayload: serializedExecutionData,
                compressedPayload: executionDataCompressed
            });
        } catch (error: unknown) {
            logger.warn(
                {
                    analysisId: input.analysisId,
                    err: error,
                    ...createTraceLogContext(input.traceContext)
                },
                'Failed to store shared analysis execution data reference; falling back to inline payloads'
            );
        }

        const queuePayloadBytesAfter = executionDataReference
            ? measurePayloadBytes({
                ...jobs[0],
                executionDataCompressed,
                executionDataReference
            })
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
            stage: ProgressStageType.Queued,
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

        const queuedJobNotifications: QueuedJobNotification[] = jobs.map((job) => ({
            jobId: job.jobId,
            name: job.name,
            teamId: job.teamId,
            timestep: job.timestep!,
            trajectoryId: input.trajectoryId,
            trajectoryName: input.trajectoryName,
            analysisId: input.analysisId,
            queueType: ANALYSIS_QUEUE_NAME
        }));

        return {
            queued: true,
            totalJobs: jobs.length,
            jobs: queuedJobNotifications
        };
    }

    private buildJobs(input: AnalysisStartRequestWithTrace, items: PlannedExecutionItem[]): AnalysisQueueJobPayload[] {
        const serializedTraceContext = serializeDaemonTraceContext(input.traceContext);

        return items.map((item, index) => {
            const timestep = this.resolveTimestep(item);
            if (typeof timestep === 'undefined') {
                throw DaemonCommandError.unprocessableEntity(
                    'Analysis::Start::MissingTimestep',
                    `Missing timestep for analysis job ${input.analysisId}-${index}`
                );
            }

            const inputFile = typeof item.path === 'string' && item.path.length > 0
                ? item.path
                : `trajectory-${input.trajectoryId}/timestep-${String(timestep)}.dump.zst`;

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
                    inputFile,
                    timestep,
                    plugin: input.pluginId,
                    totalItems: items.length,
                    itemIndex: index,
                    forEachItem: item,
                    forEachIndex: index,
                    traceContext: serializedTraceContext
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        });
    }

    private buildBatchJob(input: AnalysisStartRequestWithTrace, items: PlannedExecutionItem[]): AnalysisQueueJobPayload[] {
        const serializedTraceContext = serializeDaemonTraceContext(input.traceContext);

        return [{
            jobId: `${input.analysisId}-batch-0`,
            name: input.pluginDisplayName,
            teamId: input.teamId,
            timestep: 0,
            status: 'queued',
            queueType: ANALYSIS_QUEUE_NAME,
            metadata: {
                trajectoryId: input.trajectoryId,
                analysisId: input.analysisId,
                name: input.pluginDisplayName,
                config: input.config,
                plugin: input.pluginId,
                totalItems: items.length,
                batchMode: true,
                traceContext: serializedTraceContext
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }];
    }

    private resolveTimestep(item: PlannedExecutionItem): number | undefined {
        const timestepValue = Reflect.get(item, 'timestep') ?? Reflect.get(item, 'frame');
        if (typeof timestepValue === 'number' && Number.isFinite(timestepValue)) {
            return timestepValue;
        }

        return undefined;
    }

    private resolveEntrypoint(workflow: AnalysisStartRequest['workflow']): {
        binaryObjectPath: string;
        entrypointType: EntrypointType;
        arguments: string;
        timeoutMs?: number;
        requirementsFile?: string;
        entrypointScript?: string;
    } {
        const entrypoint = workflow.nodes.find((node) => node.type === 'entrypoint');
        const entrypointData = readWorkflowEntrypointData(entrypoint?.data?.entrypoint);
        if (!entrypointData?.binaryObjectPath || !entrypointData.arguments) {
            throw DaemonCommandError.badRequest(
                'Analysis::Start::InvalidEntrypoint',
                'Daemon workflow entrypoint is invalid'
            );
        }

        return {
            binaryObjectPath: entrypointData.binaryObjectPath,
            entrypointType: entrypointData.type ?? EntrypointType.Executable,
            arguments: entrypointData.arguments,
            timeoutMs: entrypointData.timeout,
            requirementsFile: entrypointData.requirementsFile,
            entrypointScript: entrypointData.entrypointScript || undefined
        };
    }

    private collectExposures(workflow: AnalysisStartRequest['workflow']): Array<{
        nodeId: string;
        name: string;
        results: string;
        iterable?: string;
        export?: {
            exporter: string;
            type: string;
            options?: Record<string, unknown>;
        };
    }> {
        const graphEdges = workflow.edges;

        return workflow.nodes
            .filter((node) => node.type === 'exposure')
            .map((node) => {
                const exposureData = node.data.exposure as {
                    name?: string;
                    results?: string;
                    iterable?: string;
                } | undefined;
                const exportEdge = graphEdges.find((edge) => edge.source === node.id);
                const exportNode = exportEdge
                    ? workflow.nodes.find((candidate) => candidate.id === exportEdge.target && candidate.type === 'export')
                    : undefined;
                const exportData = exportNode?.data?.export as {
                    exporter: string;
                    type: string;
                    options?: Record<string, unknown>;
                } | undefined;

                return {
                    nodeId: node.id,
                    name: exposureData?.name || '',
                    results: exposureData?.results || '',
                    iterable: exposureData?.iterable,
                    export: exportData
                };
            });
    }
}
