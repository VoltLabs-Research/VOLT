import { randomUUID } from 'node:crypto';
import { ProgressStageType } from '@voltstack/daemon-cluster-client';
import { Service } from '@/core/decorators/service';
import { OrchestrationAction } from '@/core/runtime/contracts/http-runtime';
import { PIPELINE_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import { serializeDaemonTraceContext } from '@/core/observability/infrastructure/daemon-instrumentation';
import { compressSerializedAnalysisExecutionData, serializeAnalysisExecutionData } from '@/support/policies/analysis-execution-data';
import { WorkflowEngine } from '@/modules/analysis/application/workflow/WorkflowEngine';
import { RuntimeEventBroker } from '@/core/reverse-channel/application/RuntimeEventBroker';
import { QueueService } from '@/core/queues/application/QueueService';
import { planAnalysisWorkflow } from '@/modules/analysis/application/analysis/plan-analysis-workflow';
import type {
    AnalysisStartRequestWithTrace,
    AnalysisStartResponse,
    PipelinePlannedStage,
    PipelineQueueJobPayload,
    PipelineStartRequestWithTrace,
    PipelineStartResolvedStage,
    QueuedJobNotification
} from '@/modules/analysis/contracts/http-analysis';
import type { AnalysisDataStore } from '@/modules/analysis/infrastructure/storage/AnalysisDataStore';

interface PreparedComputeStage {
    plan: PipelinePlannedStage;
    analysisId: string;
    name: string;
}

@Service('pipelineDispatcher')
export class PipelineDispatcher {
    constructor(
        private readonly workflowEngine: WorkflowEngine,
        private readonly analysisDataStore: AnalysisDataStore,
        private readonly eventBroker: RuntimeEventBroker,
        private readonly queueService: QueueService
    ) {}

    async startPipeline(input: PipelineStartRequestWithTrace): Promise<AnalysisStartResponse> {
        const serializedTraceContext = serializeDaemonTraceContext(input.traceContext);

        this.eventBroker.emitProgress({
            action: OrchestrationAction.PipelineStart,
            stage: ProgressStageType.Accepted,
            timestamp: new Date().toISOString(),
            payload: { traceContext: serializedTraceContext }
        });

        const timesteps = this.resolveTimesteps(input);
        const storageClusterId = this.resolveStorageClusterId(input);

        const plannedStages: PipelinePlannedStage[] = [];
        const computeStages: PreparedComputeStage[] = [];

        for (const stage of input.stages) {
            const plannedStage = await this.planStage(stage, serializedTraceContext);
            plannedStages.push(plannedStage);
            if (plannedStage.kind === 'plugin' && !plannedStage.cacheHit && plannedStage.analysisId) {
                computeStages.push({
                    plan: plannedStage,
                    analysisId: plannedStage.analysisId,
                    name: plannedStage.pluginDisplayName ?? plannedStage.pluginId ?? plannedStage.analysisId
                });
            }
        }

        const jobs: QueuedJobNotification[] = [];
        const runToken = randomUUID();
        const payloads: PipelineQueueJobPayload[] = [];
        for (const timestep of timesteps) {
            const jobId = `pipeline-${input.teamClusterId}-${input.trajectoryId}-${timestep}-${runToken}`;
            const timestamp = new Date().toISOString();
            const payload: PipelineQueueJobPayload = {
                jobId,
                teamId: input.teamId,
                trajectoryId: input.trajectoryId,
                name: 'Pipeline',
                status: 'queued',
                queueType: PIPELINE_QUEUE_NAME,
                storageClusterId,
                timestep,
                stages: plannedStages,
                traceContext: serializedTraceContext,
                createdAt: timestamp,
                updatedAt: timestamp
            };

            payloads.push(payload);

            for (const computeStage of computeStages) {
                jobs.push({
                    jobId: `${jobId}:${computeStage.analysisId}`,
                    name: computeStage.name,
                    teamId: input.teamId,
                    trajectoryId: input.trajectoryId,
                    analysisId: computeStage.analysisId,
                    timestep,
                    queueType: PIPELINE_QUEUE_NAME
                });
            }
        }

        await this.queueService.enqueueBulk(PIPELINE_QUEUE_NAME, payloads);

        this.eventBroker.emitProgress({
            action: OrchestrationAction.PipelineStart,
            stage: ProgressStageType.Queued,
            timestamp: new Date().toISOString(),
            payload: {
                totalJobs: jobs.length,
                queuedNow: timesteps.length,
                traceContext: serializedTraceContext
            }
        });

        return {
            queued: true,
            totalJobs: jobs.length,
            jobs
        };
    }

    private async planStage(
        stage: PipelineStartResolvedStage,
        serializedTraceContext?: Record<string, string>
    ): Promise<PipelinePlannedStage> {
        if (stage.kind !== 'plugin') {
            return { kind: stage.kind, config: stage.config };
        }

        if (stage.cacheHit) {
            return {
                kind: 'plugin',
                cacheHit: true,
                cacheSourceAnalysisId: stage.cacheSourceAnalysisId,
                sharedExposureIds: stage.sharedExposureIds
            };
        }

        if (!stage.plugin) {
            throw new Error('Pipeline compute stage is missing its plugin payload');
        }

        const pluginInput: AnalysisStartRequestWithTrace = {
            ...stage.plugin,
            traceContext: serializedTraceContext
        };
        const { executionData } = await planAnalysisWorkflow({
            input: pluginInput,
            workflowEngine: this.workflowEngine,
            serializedTraceContext
        });

        const serializedExecutionData = serializeAnalysisExecutionData(executionData);
        const executionDataCompressed = await compressSerializedAnalysisExecutionData(serializedExecutionData);
        const executionDataReference = await this.analysisDataStore.store(executionData, {
            serializedPayload: serializedExecutionData,
            compressedPayload: executionDataCompressed
        });

        return {
            kind: 'plugin',
            analysisId: stage.plugin.analysisId,
            pluginId: stage.plugin.pluginId,
            pluginDisplayName: stage.plugin.pluginDisplayName,
            executionDataReference,
            sharedExposureIds: stage.sharedExposureIds
        };
    }

    private resolveTimesteps(input: PipelineStartRequestWithTrace): number[] {
        if (input.selectedTimesteps?.length) {
            return input.selectedTimesteps;
        }

        const frames = input.stages
            .find((stage) => stage.kind === 'plugin' && stage.plugin)
            ?.plugin?.trajectoryFrames;
        if (!frames?.length) {
            throw new Error('Pipeline start has no selected timesteps and no trajectory frames to resolve them from');
        }

        return frames.map((frame) => frame.timestep);
    }

    private resolveStorageClusterId(input: PipelineStartRequestWithTrace): string | undefined {
        return input.storageClusterId
            ?? input.stages
                .find((stage) => stage.kind === 'plugin' && stage.plugin)
                ?.plugin?.analysis.storageClusterId;
    }
}
