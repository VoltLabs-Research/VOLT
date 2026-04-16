import { isRecord } from '@/shared/utilities/type-guards';
import type {
    DaemonAnalysisDocument,
    NestedPluginDefinition,
    TrajectoryDumpDescriptor,
    TrajectoryFrame,
    WorkflowDefinition
} from '@/shared/contracts';
import type { WorkflowExecutionContext } from '../contracts';
import { WorkflowGraph } from '../contracts';

interface WorkflowOutputsSnapshot {
    [nodeId: string]: Record<string, unknown>;
};

interface WorkflowExecutionContextFactoryParams {
    outputs?: Map<string, Record<string, unknown>>;
    userConfig: Record<string, unknown>;
    runtimeArguments: Record<string, unknown>;
    trajectoryId: string;
    trajectoryFrames: TrajectoryFrame[];
    trajectoryDumpOverrides?: TrajectoryDumpDescriptor[];
    analysis: DaemonAnalysisDocument;
    analysisId: string;
    generatedFiles?: string[];
    pluginId: string;
    teamId: string;
    selectedFrameOnly?: boolean;
    selectedTimesteps?: number[];
    selectedTimestep?: number;
    workflow: WorkflowGraph;
    nestedPlugins?: NestedPluginDefinition[];
    nestedWorkflows?: Map<string, WorkflowDefinition>;
};

const cloneWorkflowOutputValue = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map((entry) => cloneWorkflowOutputValue(entry));
    }

    if (isRecord(value)) {
        return Object.fromEntries(
            Object.entries(value).map(([key, entry]) => [key, cloneWorkflowOutputValue(entry)])
        );
    }

    return value;
};

/** Creates a serializable snapshot from workflow node outputs. */
export const snapshotWorkflowOutputs = (
    outputs: Map<string, Record<string, unknown>>
): WorkflowOutputsSnapshot => {
    const snapshot: WorkflowOutputsSnapshot = {};

    for (const [nodeId, nodeOutput] of outputs.entries()) {
        const clonedOutput = cloneWorkflowOutputValue(nodeOutput);
        snapshot[nodeId] = isRecord(clonedOutput) ? clonedOutput : {};
    }

    return snapshot;
};

/** Assembles the shared workflow execution context shape used across runtime entry points. */
export const createWorkflowExecutionContext = (
    params: WorkflowExecutionContextFactoryParams
): WorkflowExecutionContext => {
    return {
        outputs: params.outputs ?? new Map(),
        userConfig: params.userConfig,
        runtimeArguments: params.runtimeArguments,
        trajectoryId: params.trajectoryId,
        trajectoryFrames: params.trajectoryFrames,
        trajectoryDumpOverrides: params.trajectoryDumpOverrides,
        analysis: params.analysis,
        analysisId: params.analysisId,
        generatedFiles: params.generatedFiles ?? [],
        pluginId: params.pluginId,
        teamId: params.teamId,
        selectedFrameOnly: params.selectedFrameOnly,
        selectedTimesteps: params.selectedTimesteps,
        selectedTimestep: params.selectedTimestep,
        workflow: params.workflow,
        nestedWorkflows: params.nestedWorkflows ?? new Map(
            (params.nestedPlugins ?? []).map((nestedPlugin) => [nestedPlugin.pluginId, nestedPlugin.workflow])
        )
    };
};
