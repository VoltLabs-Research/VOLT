import { logger } from '@/core/logger';
import { Service } from '@/core/decorators/service';
import { WorkflowNodeExecutor } from '@/modules/analysis/application/workflow/WorkflowNodeExecutor';
import { WorkflowNodeRegistry } from '@/modules/analysis/application/workflow/NodeRegistry';
import { WorkflowSession } from '@/modules/analysis/application/workflow/WorkflowSession';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import type { DaemonAnalysisDocument, NestedPluginDefinition, TrajectoryDumpDescriptor, TrajectoryFrame, WorkflowDefinition } from '@/contracts';
import type { WorkflowNodeOutput } from '@/modules/analysis/contracts/workflow.types';

interface WorkflowRuntimeArgumentSelection extends WorkflowNodeOutput {
    value: number;
}

export interface WorkflowExecutionRequest {
    workflow: WorkflowDefinition;
    nestedPlugins?: NestedPluginDefinition[];
    trajectoryId: string;
    trajectoryFrames: TrajectoryFrame[];
    analysis: DaemonAnalysisDocument;
    analysisId: string;
    pluginId: string;
    userConfig: WorkflowNodeOutput;
    teamId: string;
    selectedFrameOnly?: boolean;
    selectedTimesteps?: number[];
    timestep?: number;
}

interface WorkflowForEachPlanOutput extends WorkflowNodeOutput {
    items: WorkflowNodeOutput[];
}

interface WorkflowContextPlanOutput extends WorkflowNodeOutput {
    trajectory_dumps: TrajectoryDumpDescriptor[];
}

interface WorkflowPlanResult {
    items: Array<WorkflowNodeOutput | TrajectoryDumpDescriptor>;
    forEachNodeId?: string;
    nodeOutputSnapshots: Record<string, WorkflowNodeOutput>;
    batchMode?: boolean;
    batchTrajectoryDumps?: TrajectoryDumpDescriptor[];
    contextNodeId?: string;
};

const createRuntimeArguments = (request: WorkflowExecutionRequest): WorkflowNodeOutput => {
    if (!request?.selectedTimesteps?.length) {
        return {};
    }

    return {
        selectedTimesteps: request.selectedTimesteps.map(
            (timestep): WorkflowRuntimeArgumentSelection => ({ value: timestep })
        )
    };
};

const createPlanningSession = (request: WorkflowExecutionRequest): WorkflowSession => {
    const { ...sessionParams } = request;

    return WorkflowSession.createFromDefinition({
        ...sessionParams,
        runtimeArguments: createRuntimeArguments(request)
    });
};

const createBatchPlan = (
    session: WorkflowSession,
    contextNodeId: string
): WorkflowPlanResult | null => {
    const dumps = (session.getOutput(contextNodeId) as WorkflowContextPlanOutput | undefined)?.trajectory_dumps;
    if (!dumps?.length) {
        return null;
    }

    return {
        items: dumps,
        nodeOutputSnapshots: session.snapshotOutputs(),
        batchMode: true,
        batchTrajectoryDumps: dumps,
        contextNodeId
    };
};

@Service('workflowEngine')
export class WorkflowEngine {
    private readonly nodeExecutor: WorkflowNodeExecutor;

    constructor(
        private readonly registry: WorkflowNodeRegistry
    ) {
        this.nodeExecutor = new WorkflowNodeExecutor(registry);
    }

    async planExecutionStrategy(request: WorkflowExecutionRequest): Promise<WorkflowPlanResult | null> {
        const session = createPlanningSession(request);
        const executionOrder = session.context.workflow.topologicalSort();
        const hasForEachNode = executionOrder.some((node) => node.type === WorkflowNodeType.ForEach);

        logger.info(`@daemon-workflow-engine: planning execution for plugin "${request.pluginId}" (batchMode=${!hasForEachNode})`);
        let contextNodeId: string | undefined;

        const results = await this.nodeExecutor.executeOrdered({
            nodes: executionOrder,
            context: session.context,
            shouldSkipNode: (node) => {
                return [
                    WorkflowNodeType.Plugin,
                    WorkflowNodeType.Entrypoint,
                    WorkflowNodeType.Exposure,
                    WorkflowNodeType.Export
                ].includes(node.type)
                    ? `Node type "${node.type}" is skipped during planning`
                    : undefined;
            },
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
                    nodeOutputSnapshots: session.snapshotOutputs()
                };
            }
        }

        if (!hasForEachNode && contextNodeId) {
            return createBatchPlan(session, contextNodeId);
        }

        return null;
    }
};
