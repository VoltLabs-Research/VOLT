import { singleton } from '@shared/application/utilities/singleton';
import { logger } from '@shared/infrastructure/logger';
import { WorkflowNodeExecutor } from '@modules/analysis/services/workflow/WorkflowNodeExecutor';
import { WorkflowPlanner } from '@modules/analysis/services/workflow/WorkflowPlanner';
import { WorkflowNodeRegistry, getWorkflowNodeRegistry, isPlanningNodeType } from '@modules/analysis/services/workflow/NodeRegistry';
import { WorkflowSession } from '@modules/analysis/services/workflow/WorkflowSession';
import { WorkflowTrajectoryWindowHandler } from '@modules/analysis/services/workflow/nodes/TrajectoryWindowHandler';
import { WorkflowNodeType } from '@shared/contracts/types/workflow.types';
import type { DaemonAnalysisDocument, NestedPluginDefinition, TrajectoryDumpDescriptor, TrajectoryFrame, WorkflowDefinition, WorkflowTrajectoryWindowData } from '@shared/contracts';
import type { PlannedExecutionItem, WorkflowWindowMode } from '@shared/contracts/types/http-analysis';
import type { WorkflowNodeOutput } from '@shared/contracts/types/workflow.types';

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

interface WorkflowContextPlanOutput extends WorkflowNodeOutput {
    trajectory_dumps: TrajectoryDumpDescriptor[];
}

interface WorkflowPlanResult {
    items: Array<WorkflowNodeOutput | TrajectoryDumpDescriptor | PlannedExecutionItem>;
    forEachNodeId?: string;
    trajectoryWindowNodeId?: string;
    nodeOutputSnapshots: Record<string, WorkflowNodeOutput>;
};

const createRuntimeArguments = (request: WorkflowExecutionRequest): WorkflowNodeOutput => {
    if (!request.selectedTimesteps?.length) {
        return {};
    }

    return {
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

const createTrajectoryWindowPlan = (
    session: WorkflowSession,
    windowNodeId: string,
    windowData: WorkflowTrajectoryWindowData,
    contextNodeId: string | undefined
): WorkflowPlanResult | null => {
    const dumps = contextNodeId
        ? (session.getOutput(contextNodeId) as WorkflowContextPlanOutput | undefined)?.trajectory_dumps
        : undefined;
    if (!dumps?.length) {
        return null;
    }

    const dumpByTimestep = new Map(dumps.map((dump) => [dump.timestep, dump]));
    const timesteps = dumps.map((dump) => dump.timestep);
    const planItems = WorkflowTrajectoryWindowHandler.planItems(windowData, timesteps);
    const windowMode: WorkflowWindowMode = windowData.mode;

    const items: PlannedExecutionItem[] = planItems.map((item) => {
        const primaryDump = dumpByTimestep.get(item.primaryTimestep);
        return {
            timestep: item.primaryTimestep,
            path: primaryDump?.path,
            windowMode,
            windowSize: windowData.windowSize,
            referenceTimestep: windowData.referenceTimestep,
            windowTimesteps: item.windowTimesteps
        };
    });

    return {
        items,
        trajectoryWindowNodeId: windowNodeId,
        nodeOutputSnapshots: WorkflowSession.snapshotOutputs(session.outputs)
    };
};

const PLANNING_EVALUATED_RUNTIME_NODE_TYPES: ReadonlySet<WorkflowNodeType> = new Set([
    WorkflowNodeType.IfStatement,
    WorkflowNodeType.SwitchStatement,
    WorkflowNodeType.SwitchCase
]);

export class WorkflowEngine {
    private readonly planner: WorkflowPlanner;

    constructor(registry: WorkflowNodeRegistry) {
        this.planner = new WorkflowPlanner(new WorkflowNodeExecutor(registry));
    }

    async planExecutionStrategy(request: WorkflowExecutionRequest): Promise<WorkflowPlanResult | null> {
        const session = createPlanningSession(request);
        const executionOrder = session.context.workflow.topologicalSort();
        const hasForEachNode = executionOrder.some((node) => node.type === WorkflowNodeType.ForEach);
        const windowNode = executionOrder.find((node) => node.type === WorkflowNodeType.TrajectoryWindow);

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

        if (windowNode?.data.trajectoryWindow?.mode) {
            return createTrajectoryWindowPlan(
                session,
                windowNode.id,
                windowNode.data.trajectoryWindow,
                outcome.contextNodeId
            );
        }

        if (!hasForEachNode && outcome.contextNodeId) {
            return createContextItemsPlan(session, outcome.contextNodeId);
        }

        return null;
    }
};

export const getWorkflowEngine = singleton((): WorkflowEngine => new WorkflowEngine(getWorkflowNodeRegistry()));
