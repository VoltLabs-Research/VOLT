import { logger } from '@/core/logger';
import { runOrderedWorkflowNodes } from '@/modules/analysis/application/workflow/OrderedNodeRunner';
import { createWorkflowExecutionContext, snapshotWorkflowOutputs } from '@/modules/analysis/application/workflow/WorkflowExecutionContextFactory';
import { WorkflowNodeRegistry } from '@/modules/analysis/application/workflow/NodeRegistry';
import { WorkflowGraph, WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import type { DaemonAnalysisDocument, NestedPluginDefinition, TrajectoryDumpDescriptor, TrajectoryFrame, WorkflowDefinition } from '@/contracts';
import type { WorkflowNodeOutput } from '@/modules/analysis/contracts/workflow.types';

interface WorkflowExecutionOptions {
    selectedFrameOnly?: boolean;
    selectedTimesteps?: number[];
    timestep?: number;
}

interface WorkflowRuntimeArgumentSelection extends WorkflowNodeOutput {
    value: number;
}

interface WorkflowExecutionRequest {
    workflow: WorkflowDefinition;
    nestedPlugins?: NestedPluginDefinition[];
    trajectoryId: string;
    trajectoryFrames: TrajectoryFrame[];
    analysis: DaemonAnalysisDocument;
    analysisId: string;
    pluginId: string;
    userConfig: WorkflowNodeOutput;
    teamId: string;
    options?: WorkflowExecutionOptions;
}

interface WorkflowForEachPlanOutput extends WorkflowNodeOutput {
    items: WorkflowNodeOutput[];
}

interface WorkflowContextPlanOutput extends WorkflowNodeOutput {
    trajectory_dumps: TrajectoryDumpDescriptor[];
}

interface WorkflowPlanResult {
    items: Array<WorkflowNodeOutput | TrajectoryDumpDescriptor>;
    forEachNodeId: string;
    nodeOutputSnapshots: Record<string, WorkflowNodeOutput>;
    batchMode?: boolean;
    batchTrajectoryDumps?: TrajectoryDumpDescriptor[];
    contextNodeId?: string;
};

const createRuntimeArguments = (request: WorkflowExecutionRequest): WorkflowNodeOutput => {
    if (!request.options?.selectedTimesteps?.length) {
        return {};
    }

    return {
        selectedTimesteps: request.options.selectedTimesteps.map(
            (timestep): WorkflowRuntimeArgumentSelection => ({ value: timestep })
        )
    };
};

const createPlanningContext = (request: WorkflowExecutionRequest) => {
    return createWorkflowExecutionContext({
        userConfig: request.userConfig,
        runtimeArguments: createRuntimeArguments(request),
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
};

const createBatchPlan = (
    context: ReturnType<typeof createWorkflowExecutionContext>,
    contextNodeId: string
): WorkflowPlanResult | null => {
    const dumps = (context.outputs.get(contextNodeId) as WorkflowContextPlanOutput | undefined)?.trajectory_dumps;
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
};

export class WorkflowEngine {
    constructor(
        private readonly registry: WorkflowNodeRegistry
    ) {}

    async planExecutionStrategy(request: WorkflowExecutionRequest): Promise<WorkflowPlanResult | null> {
        const context = createPlanningContext(request);
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

            if (result.node.type === WorkflowNodeType.ForEach) {
                const items = (result.output as WorkflowForEachPlanOutput).items;

                return {
                    items,
                    forEachNodeId: result.node.id,
                    nodeOutputSnapshots: snapshotWorkflowOutputs(context.outputs)
                };
            }
        }

        if (!hasForEachNode && contextNodeId) {
            return createBatchPlan(context, contextNodeId);
        }

        return null;
    }
};
