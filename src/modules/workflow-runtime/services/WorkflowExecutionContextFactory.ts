import { isRecord } from '@/shared/utils';
import type { DaemonAnalysisDocument, NestedPluginDefinition, WorkflowDefinition } from '@/shared/contracts';
import type { WorkflowExecutionContext } from '../contracts';
import { WorkflowGraph } from '../contracts';

export interface WorkflowOutputsSnapshot {
    [nodeId: string]: Record<string, unknown>;
};

export interface WorkflowExecutionContextFactoryParams {
    outputs?: Map<string, Record<string, unknown>>;
    userConfig: Record<string, unknown>;
    runtimeArguments: Record<string, unknown>;
    trajectoryId: string;
    trajectoryFrames: Array<{ timestep: number; natoms: number; simulationCell: string; }>;
    trajectoryDumpOverrides?: Array<{ timestep: number; natoms: number; simulationCell: string; path: string; originalPath?: string; }>;
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

/** Restores workflow node outputs from a serializable snapshot. */
export const restoreWorkflowOutputs = (
    snapshot: WorkflowOutputsSnapshot
): Map<string, Record<string, unknown>> => {
    const outputs = new Map<string, Record<string, unknown>>();

    for (const [nodeId, nodeOutput] of Object.entries(snapshot)) {
        const clonedOutput = cloneWorkflowOutputValue(nodeOutput);
        outputs.set(nodeId, isRecord(clonedOutput) ? clonedOutput : {});
    }

    return outputs;
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
