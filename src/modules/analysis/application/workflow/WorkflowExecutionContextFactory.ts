import type { DaemonAnalysisDocument, NestedPluginDefinition, TrajectoryDumpDescriptor, TrajectoryFrame, WorkflowDefinition } from '@/contracts';
import type { WorkflowExecutionContext, WorkflowNodeOutput, WorkflowValueMap } from '@/modules/analysis/contracts/workflow.types';
import { WorkflowGraph } from '@/modules/analysis/contracts/workflow.types';

interface WorkflowOutputsSnapshot {
    [nodeId: string]: WorkflowNodeOutput;
};

interface WorkflowExecutionContextFactoryParams {
    outputs?: Map<string, WorkflowNodeOutput>;
    userConfig: WorkflowValueMap;
    runtimeArguments: WorkflowValueMap;
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

/** Creates a serializable snapshot from workflow node outputs. */
export const snapshotWorkflowOutputs = (
    outputs: Map<string, WorkflowNodeOutput>
): WorkflowOutputsSnapshot => {
    const snapshot: WorkflowOutputsSnapshot = {};

    for (const [nodeId, nodeOutput] of outputs.entries()) {
        snapshot[nodeId] = structuredClone(nodeOutput);
    }

    return snapshot;
};

/** Assembles the shared workflow execution context shape used across runtime entry points. */
export const createWorkflowExecutionContext = (
    {
        outputs = new Map<string, WorkflowNodeOutput>(),
        userConfig,
        runtimeArguments,
        trajectoryId,
        trajectoryFrames,
        trajectoryDumpOverrides,
        analysis,
        analysisId,
        generatedFiles = [],
        pluginId,
        teamId,
        selectedFrameOnly,
        selectedTimesteps,
        selectedTimestep,
        workflow,
        nestedPlugins = [],
        nestedWorkflows = new Map(
            nestedPlugins.map((nestedPlugin) => [nestedPlugin.pluginId, nestedPlugin.workflow])
        )
    }: WorkflowExecutionContextFactoryParams
): WorkflowExecutionContext => {
    const context: WorkflowExecutionContext = {
        outputs,
        userConfig,
        runtimeArguments,
        trajectoryId,
        trajectoryFrames,
        trajectoryDumpOverrides,
        analysis,
        analysisId,
        generatedFiles,
        pluginId,
        teamId,
        selectedFrameOnly,
        selectedTimesteps,
        selectedTimestep,
        workflow,
        nestedWorkflows
    };

    return context;
};
