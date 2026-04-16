import { logger } from '@/core/logger';
import { runOrderedWorkflowNodes } from './OrderedNodeRunner';
import { createWorkflowExecutionContext, snapshotWorkflowOutputs } from './WorkflowExecutionContextFactory';
import { WorkflowNodeRegistry } from './NodeRegistry';
import { WorkflowGraph, WorkflowNodeType } from '../contracts';
import type {
    DaemonAnalysisDocument,
    NestedPluginDefinition,
    TrajectoryDumpDescriptor,
    TrajectoryFrame,
    WorkflowDefinition
} from '@/shared/contracts';
import type { WorkflowExecutionContext } from '../contracts';

interface WorkflowPlanResult {
    items: Array<Record<string, unknown> | TrajectoryDumpDescriptor>;
    forEachNodeId: string;
    nodeOutputSnapshots: Record<string, Record<string, unknown>>;
    batchMode?: boolean;
    batchTrajectoryDumps?: TrajectoryDumpDescriptor[];
    contextNodeId?: string;
};

interface WorkflowExecutionRequest {
    workflow: WorkflowDefinition;
    nestedPlugins?: NestedPluginDefinition[];
    trajectoryId: string;
    trajectoryFrames: TrajectoryFrame[];
    analysis: DaemonAnalysisDocument;
    analysisId: string;
    pluginId: string;
    userConfig: Record<string, unknown>;
    teamId: string;
    options?: {
        selectedFrameOnly?: boolean;
        selectedTimesteps?: number[];
        timestep?: number;
    };
};

const buildRuntimeArguments = (request: WorkflowExecutionRequest): Record<string, unknown> => {
    if (!request.options?.selectedTimesteps?.length) {
        return {};
    }

    return {
        selectedTimesteps: request.options.selectedTimesteps.map((timestep) => ({ value: timestep }))
    };
};

export class WorkflowEngine {
    constructor(
        private readonly registry: WorkflowNodeRegistry
    ) {}

    async planExecutionStrategy(request: WorkflowExecutionRequest): Promise<WorkflowPlanResult | null> {
        const context = this.createExecutionContext(request);
        const executionOrder = context.workflow.topologicalSort();
        const hasForEachNode = executionOrder.some((node) => node.type === WorkflowNodeType.ForEach);

        logger.info(`@daemon-workflow-engine: planning execution for plugin "${request.pluginId}" (batchMode=${!hasForEachNode})`);
        let contextNodeId: string | undefined;

        const results = await runOrderedWorkflowNodes({
            nodes: executionOrder,
            context,
            registry: this.registry,
            stopAfterNode: (result) => result.status === 'executed' && result.node.type === WorkflowNodeType.ForEach
        });

        for (const result of results) {
            if (result.status !== 'executed') {
                continue;
            }

            if (result.node.type === WorkflowNodeType.Context) {
                contextNodeId = result.node.id;
            }

            if (result.node.type === WorkflowNodeType.ForEach && result.output?.items && Array.isArray(result.output.items)) {
                const items = result.output.items as Record<string, unknown>[];

                return {
                    items,
                    forEachNodeId: result.node.id,
                    nodeOutputSnapshots: snapshotWorkflowOutputs(context.outputs)
                };
            }
        }

        // Batch mode: no ForEach node — pass authoritative dump descriptors as a single batch
        if (!hasForEachNode && contextNodeId) {
            const dumps = context.outputs.get(contextNodeId)?.trajectory_dumps as TrajectoryDumpDescriptor[] | undefined;

            if (!dumps?.length) {
                return null;
            }

            return {
                items: dumps,
                forEachNodeId: '',
                nodeOutputSnapshots: snapshotWorkflowOutputs(context.outputs),
                batchMode: true,
                batchTrajectoryDumps: dumps,
                contextNodeId
            };
        }

        return null;
    }

    private createExecutionContext(request: WorkflowExecutionRequest): WorkflowExecutionContext {
        return createWorkflowExecutionContext({
            userConfig: request.userConfig,
            runtimeArguments: buildRuntimeArguments(request),
            trajectoryId: request.trajectoryId,
            trajectoryFrames: request.trajectoryFrames,
            analysis: request.analysis,
            analysisId: request.analysisId,
            pluginId: request.pluginId,
            teamId: request.teamId,
            selectedFrameOnly: request.options?.selectedFrameOnly,
            selectedTimesteps: request.options?.selectedTimesteps,
            selectedTimestep: request.options?.timestep,
            workflow: new WorkflowGraph(request.workflow),
            nestedPlugins: request.nestedPlugins
        });
    }
};
