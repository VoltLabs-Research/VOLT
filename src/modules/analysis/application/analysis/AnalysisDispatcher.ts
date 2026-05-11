import { ProgressStageType } from '@voltstack/daemon-cluster-client';
import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import { OrchestrationAction } from '@/core/runtime/contracts/http-runtime';
import { ANALYSIS_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import { QueueService } from '@/core/queues/application/QueueService';
import { serializeDaemonTraceContext } from '@/core/observability/infrastructure/daemon-instrumentation';
import { compressSerializedAnalysisExecutionData, serializeAnalysisExecutionData } from '@/support/policies/analysis-execution-data';
import { WorkflowEngine, type WorkflowExecutionRequest } from '@/modules/analysis/application/workflow/WorkflowEngine';
import { RuntimeEventBroker } from '@/core/reverse-channel/application/RuntimeEventBroker';
import { RedisConnection } from '@/core/storage/infrastructure/redis/RedisConnection';
import { planAnalysisWorkflow } from '@/modules/analysis/application/analysis/plan-analysis-workflow';
import { createHash } from 'node:crypto';
import type {
    AnalysisStartRequestWithTrace,
    AnalysisStartResponse,
    QueuedJobNotification
} from '@/modules/analysis/contracts/http-analysis';
import type { AnalysisDataStore } from '@/modules/analysis/infrastructure/storage/AnalysisDataStore';

const PLAN_CACHE_TTL_SECONDS = 600;

type WorkflowPlanResult = NonNullable<Awaited<ReturnType<WorkflowEngine['planExecutionStrategy']>>>;

@Service('analysisDispatcher')
export class AnalysisDispatcher {
    constructor(
        private readonly workflowEngine: WorkflowEngine,
        private readonly queueService: QueueService,
        private readonly analysisDataStore: AnalysisDataStore,
        private readonly eventBroker: RuntimeEventBroker,
        private readonly redisConnection: RedisConnection
    ) {}

    private buildPlanCacheKey(request: WorkflowExecutionRequest): string {
        const hash = createHash('sha1');
        const addSection = (name: string, value: unknown): void => {
            hash.update(name);
            hash.update('\0');
            hash.update(JSON.stringify(value) ?? 'undefined');
            hash.update('\0');
        };

        addSection('workflow', request.workflow);
        addSection('userConfig', request.userConfig);
        addSection('trajectoryFrames', request.trajectoryFrames);
        addSection('nestedPlugins', request.nestedPlugins);
        addSection('selectedFrameOnly', request.selectedFrameOnly);
        addSection('selectedTimesteps', request.selectedTimesteps);
        addSection('timestep', request.timestep);
        addSection('trajectoryId', request.trajectoryId);

        return `analysis-plan:${request.pluginId}:${hash.digest('hex')}`;
    }

    private async loadCachedPlan(cacheKey: string): Promise<WorkflowPlanResult | null> {
        try {
            const cached = await this.redisConnection.getValue(cacheKey);
            if (!cached) return null;
            return JSON.parse(cached) as WorkflowPlanResult;
        } catch (error) {
            logger.warn({ err: error, cacheKey }, '@analysis-dispatcher: plan cache read failed');
            return null;
        }
    }

    private async storeCachedPlan(cacheKey: string, plan: WorkflowPlanResult): Promise<void> {
        try {
            await this.redisConnection.setValueWithTtl(cacheKey, JSON.stringify(plan), PLAN_CACHE_TTL_SECONDS);
        } catch (error) {
            logger.warn({ err: error, cacheKey }, '@analysis-dispatcher: plan cache write failed');
        }
    }

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

        const planRequest: WorkflowExecutionRequest = {
            ...input,
            userConfig: input.config
        };
        const planCacheKey = this.buildPlanCacheKey(planRequest);
        const cachedPlan = await this.loadCachedPlan(planCacheKey);

        const { executionData, jobs, plan } = await planAnalysisWorkflow({
            input,
            workflowEngine: this.workflowEngine,
            serializedTraceContext,
            cachedPlan
        });

        if (!cachedPlan) {
            await this.storeCachedPlan(planCacheKey, plan);
        }

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
