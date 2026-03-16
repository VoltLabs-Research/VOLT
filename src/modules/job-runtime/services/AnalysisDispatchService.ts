import { EntrypointType } from '@/shared/contracts';
import type { AnalysisStartRequest, AnalysisQueueJobPayload } from '@/shared/contracts';
import { OrchestrationAction } from '@/shared/contracts';
import { ProgressStageType } from '@voltstack/daemon-cluster-client';
import { RuntimeEventBroker } from '@/shared/services';
import { QueueService } from '@/modules/platform/services';
import { RedisConnectionService } from '@/modules/platform/services';
import { ANALYSIS_QUEUE_NAME } from '@/modules/platform/services';
import { WorkflowEngine } from '@/modules/workflow-runtime/services';

export class AnalysisDispatchService {
    constructor(
        private readonly workflowEngine: WorkflowEngine,
        private readonly queueService: QueueService,
        private readonly redisConnectionService: RedisConnectionService,
        private readonly eventBroker: RuntimeEventBroker
    ) {}

    async startAnalysis(input: AnalysisStartRequest): Promise<{ queued: boolean; totalJobs: number; }> {
        this.eventBroker.emitProgress({
            action: OrchestrationAction.AnalysisStart,
            stage: ProgressStageType.Accepted,
            timestamp: new Date().toISOString(),
            payload: {
                analysisId: input.analysisId
            }
        });

        const plan = await this.workflowEngine.planExecutionStrategy({
            workflow: input.workflow,
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

        const jobs = this.buildJobs(input, plan.items);
        for (const job of jobs) {
            await this.queueService.enqueue(ANALYSIS_QUEUE_NAME, {
                ...job,
                executionData: {
                    ...this.resolveEntrypoint(input.workflow),
                    pluginId: input.pluginId,
                    trajectoryId: input.trajectoryId,
                    analysisId: input.analysisId,
                    teamClusterId: input.teamClusterId,
                    exposures: this.collectExposures(input.workflow),
                    forEachNodeId: plan.forEachNodeId,
                    nodeOutputSnapshots: plan.nodeOutputSnapshots
                }
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
                totalJobs: jobs.length
            }
        });

        return {
            queued: true,
            totalJobs: jobs.length
        };
    }

    private buildJobs(input: AnalysisStartRequest, items: Record<string, unknown>[]): AnalysisQueueJobPayload[] {
        return items.map((item, index) => {
            const timestep = this.resolveTimestep(item);
            if (typeof timestep === 'undefined') {
                throw new Error(`Missing timestep for analysis job ${input.analysisId}-${index}`);
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
                    inputFile: `trajectory-${input.trajectoryId}/timestep-${String(timestep)}.dump.gz`,
                    timestep,
                    plugin: input.pluginId,
                    totalItems: items.length,
                    itemIndex: index,
                    forEachItem: item,
                    forEachIndex: index
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        });
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
