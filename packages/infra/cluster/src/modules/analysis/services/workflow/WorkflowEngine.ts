import { singleton } from '@shared/utilities/singleton';
import { logger } from '@shared/logger';
import { WorkflowNodeExecutor } from '@modules/analysis/services/workflow/WorkflowNodeExecutor';
import { WorkflowPlanner } from '@modules/analysis/services/workflow/WorkflowPlanner';
import { WorkflowNodeRegistry, getWorkflowNodeRegistry, isPlanningNodeType } from '@modules/analysis/services/workflow/NodeRegistry';
import { WorkflowSession } from '@modules/analysis/services/workflow/WorkflowSession';
import { resolvePluginNativeThreadBudget } from '@shared/utilities/runtime-capacity';
import type { TrajectoryDumpDescriptor } from '@shared/contracts/types/http-workflow';
import type { PlannedExecutionItem } from '@shared/contracts/types/http-analysis';
import type { WorkflowNodeOutput } from '@shared/contracts/types/workflow.types';
import { NodeType } from '@volt/contracts/modules/plugin/enums';
import type { IWorkflow } from '@volt/contracts/modules/plugin/workflow';
import type {
    DaemonAnalysisDocument,
    NestedPluginDefinition,
    TrajectoryFrame
} from '@volt/contracts/modules/analysis/daemon';

interface WorkflowRuntimeArgumentSelection extends WorkflowNodeOutput {
    value: number;
}

export interface WorkflowExecutionRequest {
    workflow: IWorkflow;
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

interface WorkflowContextPlanOutput extends WorkflowNodeOutput {
    trajectory_dumps: TrajectoryDumpDescriptor[];
}

interface WorkflowPlanResult {
    items: Array<WorkflowNodeOutput | TrajectoryDumpDescriptor | PlannedExecutionItem>;
    forEachNodeId?: string;
    nodeOutputSnapshots: Record<string, WorkflowNodeOutput>;
};

const createRuntimeArguments = (request: WorkflowExecutionRequest): WorkflowNodeOutput => {
    const runtimeArguments: WorkflowNodeOutput = {
        threads: resolvePluginNativeThreadBudget()
    };

    if (!request.selectedTimesteps?.length) {
        return runtimeArguments;
    }

    return {
        ...runtimeArguments,
        selectedTimesteps: request.selectedTimesteps.map(
            (timestep): WorkflowRuntimeArgumentSelection => ({ value: timestep })
        )
    };
};

const createPlanningSession = (request: WorkflowExecutionRequest): WorkflowSession => {
    return WorkflowSession.createFromDefinition({
        ...request,
        runtimeArguments: createRuntimeArguments(request)
    });
};

const createContextItemsPlan = (
    session: WorkflowSession,
    contextNodeId: string
): WorkflowPlanResult | null => {
    const dumps = (session.getOutput(contextNodeId) as WorkflowContextPlanOutput | undefined)?.trajectory_dumps;
    if (!dumps?.length) {
        return null;
    }

    return {
        items: dumps,
        nodeOutputSnapshots: WorkflowSession.snapshotOutputs(session.outputs)
    };
};

const PLANNING_EVALUATED_RUNTIME_NODE_TYPES: ReadonlySet<NodeType> = new Set([
    NodeType.IF_STATEMENT,
    NodeType.SWITCH_STATEMENT,
    NodeType.SWITCH_CASE
]);

export class WorkflowEngine {
    private readonly planner: WorkflowPlanner;

    constructor(registry: WorkflowNodeRegistry) {
        this.planner = new WorkflowPlanner(new WorkflowNodeExecutor(registry));
    }

    async planExecutionStrategy(request: WorkflowExecutionRequest): Promise<WorkflowPlanResult | null> {
        const session = createPlanningSession(request);
        const executionOrder = session.context.workflow.topologicalSort();
        const hasForEachNode = executionOrder.some((node) => node.type === NodeType.FOREACH);

        logger.info(`@daemon-workflow-engine: planning execution for plugin "${request.pluginId}" (itemized=true)`);

        const outcome = await this.planner.plan({
            nodes: executionOrder,
            context: session.context,
            shouldSkipNode: (node) => !isPlanningNodeType(node.type)
                && !PLANNING_EVALUATED_RUNTIME_NODE_TYPES.has(node.type)
        });

        if (outcome.forEach) {
            return {
                items: outcome.forEach.items,
                forEachNodeId: outcome.forEach.node.id,
                nodeOutputSnapshots: WorkflowSession.snapshotOutputs(session.outputs)
            };
        }

        if (!hasForEachNode && outcome.contextNodeId) {
            return createContextItemsPlan(session, outcome.contextNodeId);
        }

        return null;
    }
};

export const getWorkflowEngine = singleton((): WorkflowEngine => new WorkflowEngine(getWorkflowNodeRegistry()));
