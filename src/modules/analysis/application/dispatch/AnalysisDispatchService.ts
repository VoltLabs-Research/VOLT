import { logger } from '@/core/logger';
import { DaemonCommandError } from '@/core/reverse-channel/application/DaemonCommandError';
import { ANALYSIS_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import { QueueService } from '@/core/queues/application/QueueService';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import { createTraceLogContext, serializeDaemonTraceContext } from '@/core/observability/infrastructure/daemonInstrumentation';
import { compressSerializedAnalysisExecutionData, serializeAnalysisExecutionData } from '@/support/policies/analysis-execution-data';
import { collectWorkflowExposureDefinitions } from '@/modules/analysis/application/workflow/ExposureExportLinking';
import { WorkflowEngine } from '@/modules/analysis/application/workflow/WorkflowEngine';
import { EntrypointType, OrchestrationAction } from '@/contracts';
import { RuntimeEventBroker } from '@/core/reverse-channel/application/RuntimeEventBroker';
import { ProgressStageType } from '@voltstack/daemon-cluster-client';
import type { AnalysisExecutionDataStore } from '@/modules/analysis/infrastructure/storage/AnalysisExecutionDataStore';
import type { AnalysisExecutionDataReference, AnalysisJobExecutionData, AnalysisQueueJobPayload, AnalysisStartRequest, AnalysisStartResponse, QueuedJobNotification, TrajectoryDumpDescriptor } from '@/contracts';
import type { DaemonTraceContext } from '@/core/observability/infrastructure/daemonInstrumentation';

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
        const executionData = this.buildExecutionData(input, plan, serializedTraceContext, isBatchMode);

        const queuePayloadBytesBefore = measurePayloadBytes({
            ...jobs[0],
            executionData
        });
        const {
            executionDataCompressed,
            executionDataReference
        } = await this.storeExecutionDataReference(input, executionData);

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

        const queuedPayloads = this.buildQueuedPayloads(
            jobs,
            executionData,
            executionDataReference,
            executionDataCompressed
        );

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

        return {
            queued: true,
            totalJobs: jobs.length,
            jobs: this.buildQueuedJobNotifications(input, jobs)
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

    private buildExecutionData(
        input: AnalysisStartRequestWithTrace,
        plan: NonNullable<Awaited<ReturnType<WorkflowEngine['planExecutionStrategy']>>>,
        serializedTraceContext: Record<string, string> | undefined,
        isBatchMode: boolean
    ): AnalysisJobExecutionData {
        const batchTrajectoryDumps = isBatchMode ? plan.batchTrajectoryDumps : undefined;

        return {
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
                allDumpUrls: batchTrajectoryDumps?.map((dump) => dump.path),
                contextNodeId: plan.contextNodeId
            } : {})
        };
    }

    private async storeExecutionDataReference(
        input: AnalysisStartRequestWithTrace,
        executionData: AnalysisJobExecutionData
    ): Promise<{
        executionDataCompressed?: string;
        executionDataReference?: AnalysisExecutionDataReference;
    }> {
        try {
            const serializedExecutionData = serializeAnalysisExecutionData(executionData);
            const executionDataCompressed = compressSerializedAnalysisExecutionData(serializedExecutionData);
            const executionDataReference = await this.analysisExecutionDataStore.store(executionData, {
                serializedPayload: serializedExecutionData,
                compressedPayload: executionDataCompressed
            });

            return {
                executionDataCompressed,
                executionDataReference
            };
        } catch (error: unknown) {
            logger.warn(
                {
                    analysisId: input.analysisId,
                    err: error,
                    ...createTraceLogContext(input.traceContext)
                },
                'Failed to store shared analysis execution data reference; falling back to inline payloads'
            );

            return {};
        }
    }

    private buildQueuedPayloads(
        jobs: AnalysisQueueJobPayload[],
        executionData: AnalysisJobExecutionData,
        executionDataReference?: AnalysisExecutionDataReference,
        executionDataCompressed?: string
    ): AnalysisQueueJobPayload[] {
        return jobs.map((job) => executionDataReference
            ? {
                ...job,
                executionDataCompressed,
                executionDataReference
            }
            : {
                ...job,
                executionData
            });
    }

    private buildQueuedJobNotifications(
        input: AnalysisStartRequestWithTrace,
        jobs: AnalysisQueueJobPayload[]
    ): QueuedJobNotification[] {
        return jobs.map((job) => ({
            jobId: job.jobId,
            name: job.name,
            teamId: job.teamId,
            timestep: job.timestep,
            trajectoryId: input.trajectoryId,
            trajectoryName: input.trajectoryName,
            analysisId: input.analysisId,
            queueType: ANALYSIS_QUEUE_NAME
        }));
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
        const entrypoint = workflow.nodes.find((node) => node.type === WorkflowNodeType.Entrypoint);
        const entrypointData = entrypoint?.data.entrypoint;
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
        return collectWorkflowExposureDefinitions(workflow);
    }
}
