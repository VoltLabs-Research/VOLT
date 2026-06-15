import { logger } from '@/core/logger';
import { Service } from '@/core/decorators/service';
import { WorkflowNodeExecutor } from '@/modules/analysis/application/workflow/WorkflowNodeExecutor';
import { WorkflowPlanner } from '@/modules/analysis/application/workflow/WorkflowPlanner';
import { WORKFLOW_NODE_PHASE, WorkflowNodeRegistry } from '@/modules/analysis/application/workflow/NodeRegistry';
import { WorkflowSession } from '@/modules/analysis/application/workflow/WorkflowSession';
import { WorkflowTrajectoryWindowHandler } from '@/modules/analysis/application/workflow/nodes/TrajectoryWindowHandler';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import type { DaemonAnalysisDocument, NestedPluginDefinition, TrajectoryDumpDescriptor, TrajectoryFrame, WorkflowDefinition, WorkflowTrajectoryWindowData } from '@/contracts';
import type { PlannedExecutionItem, WorkflowWindowMode } from '@/modules/analysis/contracts/http-analysis';
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
        nodeOutputSnapshots: session.snapshotOutputs()
    };
};

// Window fan-out: one job for `mode:'all'` (the plugin reads every frame), one
// job per primary frame otherwise (per-frame outputs preserved), each carrying
// its resolved `windowTimesteps` so AnalysisEnvironment downloads exactly that
// set. The primary dump's path/timestep drive the single-frame job fields.
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
        nodeOutputSnapshots: session.snapshotOutputs()
    };
};

/**
 * Control-flow nodes (if/switch) are classified `runtime` in
 * {@link WORKFLOW_NODE_PHASE}, but the planner must still EVALUATE them rather
 * than skip them: in the no-ForEach branch their outputs are captured in
 * `nodeOutputSnapshots`, which later seeds the runtime engine's visited-state.
 * Only the side-effecting runtime nodes (plugin/entrypoint/exposure/export)
 * are deferred ("skipped") during planning, so this set is excluded from the
 * runtime-phase skip rule below to preserve that behavior exactly.
 */
const PLANNING_EVALUATED_RUNTIME_NODE_TYPES: ReadonlySet<WorkflowNodeType> = new Set([
    WorkflowNodeType.IfStatement,
    WorkflowNodeType.SwitchStatement,
    WorkflowNodeType.SwitchCase
]);

@Service('workflowEngine')
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

        // Root planning skip-filter: defer the side-effecting runtime nodes
        // (plugin/entrypoint/exposure/export), but still EVALUATE control-flow
        // nodes (see PLANNING_EVALUATED_RUNTIME_NODE_TYPES) so their outputs are
        // captured in `nodeOutputSnapshots`. The shared planner stops once the
        // ForEach node has executed.
        const outcome = await this.planner.plan({
            nodes: executionOrder,
            context: session.context,
            shouldSkipNode: (node) => WORKFLOW_NODE_PHASE[node.type] === 'runtime'
                && !PLANNING_EVALUATED_RUNTIME_NODE_TYPES.has(node.type)
        });

        if (outcome.forEach) {
            return {
                items: outcome.forEach.items,
                forEachNodeId: outcome.forEach.node.id,
                nodeOutputSnapshots: session.snapshotOutputs()
            };
        }

        // Window plugins replace the ForEach itemization: the TrajectoryWindow
        // node's mode drives the per-job fan-out + the windowTimesteps each job
        // downloads.
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
