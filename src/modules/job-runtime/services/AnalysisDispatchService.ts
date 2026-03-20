import { logger } from '@/core/logger';
import { ANALYSIS_QUEUE_NAME, QueueService } from '@/modules/platform/services';
import { createTraceLogContext, serializeDaemonTraceContext } from '@/shared/observability/daemonInstrumentation';
import { compressAnalysisExecutionData } from '@/shared/utilities/analysis-execution-data';
import { isRecord } from '@/shared/utils';
import { WorkflowEngine } from '@/modules/workflow-runtime/services';
import { EntrypointType, OrchestrationAction } from '@/shared/contracts';
import { RuntimeEventBroker } from '@/shared/services';
import { ProgressStageType } from '@voltstack/daemon-cluster-client';
import type { AnalysisExecutionDataStore, RedisConnectionService } from '@/modules/platform/services';
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

const measurePayloadBytes = (payload: Record<string, unknown>): number => {
    return Buffer.byteLength(JSON.stringify(payload));
};

const isTrajectoryDumpDescriptor = (value: unknown): value is TrajectoryDumpDescriptor => {
    if (!isRecord(value)) {
        return false;
    }

    return typeof value.path === 'string'
        && typeof value.timestep === 'number'
        && Number.isFinite(value.timestep)
        && typeof value.natoms === 'number'
        && Number.isFinite(value.natoms)
        && typeof value.simulationCell === 'string'
        && (typeof value.originalPath === 'undefined' || typeof value.originalPath === 'string');
};

const resolvePlannedDumpPath = (item: Record<string, unknown>): string | undefined => {
    if (typeof item.path !== 'string' || item.path.length === 0) {
        return undefined;
    }

    return item.path;
};

export class AnalysisDispatchService {
    constructor(
        private readonly workflowEngine: WorkflowEngine,
        private readonly queueService: QueueService,
        private readonly analysisExecutionDataStore: AnalysisExecutionDataStore,
        private readonly redisConnectionService: RedisConnectionService,
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
            throw new Error('No items after daemon workflow planning');
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

        const batchTrajectoryDumps = isBatchMode
            ? (plan.batchTrajectoryDumps ?? plan.items.filter(isTrajectoryDumpDescriptor))
            : undefined;
        const allDumpUrls = batchTrajectoryDumps?.map((dump) => dump.path);

        const executionData: AnalysisJobExecutionData = {
            ...this.resolveEntrypoint(input.workflow),
            pluginId: input.pluginId,
            trajectoryId: input.trajectoryId,
            analysisId: input.analysisId,
            teamId: input.teamId,
            trajectoryFrames: input.trajectoryFrames,
            teamClusterId: input.teamClusterId,
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
            executionDataReference = await this.analysisExecutionDataStore.store(executionData);
            executionDataCompressed = compressAnalysisExecutionData(executionData);
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

        for (const job of jobs) {
            await this.queueService.enqueue(ANALYSIS_QUEUE_NAME, executionDataReference
                ? {
                    ...job,
                    executionDataCompressed,
                    executionDataReference
                }
                : {
                    ...job,
                    executionData
                });

            await this.redisConnectionService.projectJobStatus({
                ...job,
                jobId: job.jobId,
                teamId: job.teamId,
                status: 'queued',
                queueType: ANALYSIS_QUEUE_NAME
            });
        }

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

    private buildJobs(input: AnalysisStartRequestWithTrace, items: Record<string, unknown>[]): AnalysisQueueJobPayload[] {
        const serializedTraceContext = serializeDaemonTraceContext(input.traceContext);

        return items.map((item, index) => {
            const timestep = this.resolveTimestep(item);
            if (typeof timestep === 'undefined') {
                throw new Error(`Missing timestep for analysis job ${input.analysisId}-${index}`);
            }

            const inputFile = resolvePlannedDumpPath(item)
                ?? `trajectory-${input.trajectoryId}/timestep-${String(timestep)}.dump.gz`;

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

    private buildBatchJob(input: AnalysisStartRequestWithTrace, items: Record<string, unknown>[]): AnalysisQueueJobPayload[] {
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

    private resolveTimestep(item: Record<string, unknown>): number | undefined {
        const timestepValue = item.timestep ?? item.frame;
        if (typeof timestepValue === 'number' && Number.isFinite(timestepValue)) {
            return timestepValue;
        }

        if (typeof timestepValue === 'string' && timestepValue.trim().length > 0) {
            const parsedTimestep = Number(timestepValue);
            if (Number.isFinite(parsedTimestep)) {
                return parsedTimestep;
            }
        }

        return undefined;
    }

    private resolveEntrypoint(workflow: AnalysisStartRequest['workflow']): {
        binaryObjectPath: string;
        entrypointType: EntrypointType;
        arguments: string;
        requirementsFile?: string;
        entrypointScript?: string;
    } {
        const entrypoint = workflow.nodes.find((node) => node.type === 'entrypoint');
        const entrypointData = entrypoint?.data?.entrypoint as Record<string, unknown> | undefined;
        if (!entrypointData?.binaryObjectPath || !entrypointData.arguments) {
            throw new Error('Daemon workflow entrypoint is invalid');
        }

        return {
            binaryObjectPath: String(entrypointData.binaryObjectPath),
            entrypointType: entrypointData.type === EntrypointType.PythonScript
                ? EntrypointType.PythonScript
                : EntrypointType.Executable,
            arguments: String(entrypointData.arguments),
            requirementsFile: typeof entrypointData.requirementsFile === 'string'
                ? entrypointData.requirementsFile
                : undefined,
            entrypointScript: typeof entrypointData.entrypointScript === 'string' && entrypointData.entrypointScript.length > 0
                ? entrypointData.entrypointScript
                : undefined
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
                const exposureData = (node.data.exposure as Record<string, unknown>) || {};
                const exportEdge = graphEdges.find((edge) => edge.source === node.id);
                const exportNode = exportEdge
                    ? workflow.nodes.find((candidate) => candidate.id === exportEdge.target && candidate.type === 'export')
                    : undefined;
                const exportData = exportNode?.data?.export as Record<string, unknown> | undefined;

                return {
                    nodeId: node.id,
                    name: String(exposureData.name || ''),
                    results: String(exposureData.results || ''),
                    iterable: typeof exposureData.iterable === 'string' ? exposureData.iterable : undefined,
                    export: exportData
                        ? {
                            exporter: String(exportData.exporter || ''),
                            type: String(exportData.type || ''),
                            options: typeof exportData.options === 'object' && exportData.options !== null
                                ? exportData.options as Record<string, unknown>
                                : undefined
                        }
                        : undefined
                };
            });
    }
}
