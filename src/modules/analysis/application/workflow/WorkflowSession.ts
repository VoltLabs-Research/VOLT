import type {
    AnalysisExposureDefinition,
    DaemonAnalysisDocument,
    NestedPluginDefinition,
    TrajectoryDumpDescriptor,
    TrajectoryFrame,
    WorkflowDefinition
} from '@/contracts';
import type {
    WorkflowExecutionOptions,
    WorkflowExecutionContext,
    WorkflowNodeOutput,
    WorkflowOutputs,
    WorkflowValueMap
} from '@/modules/analysis/contracts/workflow.types';
import { WorkflowGraph, WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';

export interface WorkflowOutputsSnapshot {
    [nodeId: string]: WorkflowNodeOutput;
}

export interface WorkflowSessionParams {
    outputs?: WorkflowOutputs;
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
    execution?: WorkflowExecutionOptions;
    nestedPlugins?: NestedPluginDefinition[];
    nestedWorkflows?: Map<string, WorkflowDefinition>;
}

export interface WorkflowSessionDefinitionParams extends Omit<WorkflowSessionParams, 'workflow'> {
    workflow: WorkflowDefinition;
}

export interface WorkflowDumpSelection {
    dump: TrajectoryDumpDescriptor;
    index: number;
}

export interface WorkflowExposureMaps {
    exposuresByNodeId: Map<string, AnalysisExposureDefinition>;
    exportNodeToExposureNodeId: Map<string, string>;
}

const selectDumpFromItems = (
    items: TrajectoryDumpDescriptor[] | undefined,
    selectedTimestep: number | undefined
): WorkflowDumpSelection | null => {
    if (!items?.length) {
        return null;
    }

    if (selectedTimestep !== undefined) {
        const selectedIndex = items.findIndex((item) => item.timestep === selectedTimestep);
        if (selectedIndex === -1) {
            throw new Error(`Selected timestep ${selectedTimestep} is not available for debug execution`);
        }

        return {
            dump: items[selectedIndex],
            index: selectedIndex
        };
    }

    return {
        dump: items[0],
        index: 0
    };
};

const createNestedWorkflowMap = (
    nestedPlugins: NestedPluginDefinition[]
): Map<string, WorkflowDefinition> => new Map(
    nestedPlugins.map((nestedPlugin) => [nestedPlugin.pluginId, nestedPlugin.workflow])
);

const createWorkflowContext = (
    params: WorkflowSessionParams
): WorkflowExecutionContext => {
    const {
        nestedPlugins = [],
        outputs = new Map<string, WorkflowNodeOutput>(),
        generatedFiles = [],
        nestedWorkflows,
        ...context
    } = params;

    return {
        ...context,
        outputs,
        generatedFiles,
        nestedWorkflows: nestedWorkflows ?? createNestedWorkflowMap(nestedPlugins)
    };
};

export class WorkflowSession {
    static create(params: WorkflowSessionParams): WorkflowSession {
        return new WorkflowSession(createWorkflowContext(params));
    }

    static createFromDefinition(params: WorkflowSessionDefinitionParams): WorkflowSession {
        const { workflow, ...sessionParams } = params;

        return WorkflowSession.create({
            ...sessionParams,
            workflow: new WorkflowGraph(workflow)
        });
    }

    static snapshotOutputs(outputs: WorkflowOutputs): WorkflowOutputsSnapshot {
        const snapshot: WorkflowOutputsSnapshot = {};

        for (const [nodeId, nodeOutput] of outputs.entries()) {
            snapshot[nodeId] = structuredClone(nodeOutput);
        }

        return snapshot;
    }

    static cloneOutputs(outputs: WorkflowOutputs): WorkflowOutputs {
        const cloned: WorkflowOutputs = new Map();
        for (const [nodeId, nodeOutput] of outputs.entries()) {
            cloned.set(nodeId, structuredClone(nodeOutput));
        }
        return cloned;
    }

    static resolveContextDumps(context: WorkflowExecutionContext): TrajectoryDumpDescriptor[] {
        const overrides = context.trajectoryDumpOverrides;
        if (overrides && overrides.length > 0) {
            return overrides.map((frame) => ({
                ...frame,
                path: frame.path
            }));
        }

        const selectedTimesteps = context.selectedTimesteps?.length
            ? new Set(context.selectedTimesteps)
            : null;

        let selectedFrames: typeof context.trajectoryFrames;
        if (context.selectedFrameOnly && typeof context.selectedTimestep === 'number') {
            selectedFrames = context.trajectoryFrames.filter((frame) => frame.timestep === context.selectedTimestep);
        } else if (selectedTimesteps) {
            selectedFrames = context.trajectoryFrames.filter((frame) => selectedTimesteps.has(frame.timestep));
        } else {
            selectedFrames = context.trajectoryFrames;
        }

        return selectedFrames.map((frame) => ({
            ...frame,
            path: `trajectory-${context.trajectoryId}/timestep-${frame.timestep}.dump.zst`
        }));
    }

    static resolveSelectedDump(context: WorkflowExecutionContext): WorkflowDumpSelection | null {
        const selectedTimestep = context.selectedTimestep;
        const forEachNode = context.workflow.nodes.find((node) => node.type === WorkflowNodeType.ForEach);
        const forEachSelection = selectDumpFromItems(
            forEachNode
                ? context.outputs.get(forEachNode.id)?.items as TrajectoryDumpDescriptor[] | undefined
                : undefined,
            selectedTimestep
        );

        if (forEachSelection) {
            return forEachSelection;
        }

        const contextNode = context.workflow.nodes.find((node) => node.type === WorkflowNodeType.Context);
        return selectDumpFromItems(
            contextNode
                ? context.outputs.get(contextNode.id)?.trajectory_dumps as TrajectoryDumpDescriptor[] | undefined
                : undefined,
            selectedTimestep
        );
    }

    static createLocalDumpDescriptor(
        dump: TrajectoryDumpDescriptor,
        localPath: string,
        options: { originalPath?: string } = {}
    ): TrajectoryDumpDescriptor {
        const useExplicitOriginalPath = Object.prototype.hasOwnProperty.call(options, 'originalPath');

        return {
            ...dump,
            path: localPath,
            originalPath: useExplicitOriginalPath
                ? options.originalPath
                : dump.originalPath ?? dump.path
        };
    }

    static createLocalizedContextOutput(
        contextOutput: WorkflowNodeOutput | undefined,
        localizedDump: TrajectoryDumpDescriptor,
        outputDir: string
    ): WorkflowNodeOutput {
        const currentTrajectory = (contextOutput?.trajectory as WorkflowNodeOutput | undefined) ?? {};

        return {
            ...(contextOutput ?? {}),
            trajectory_dumps: [localizedDump],
            count: 1,
            trajectory: {
                ...currentTrajectory,
                frames: [localizedDump]
            },
            allDumpLocalPaths: JSON.stringify([localizedDump.path]),
            outputPath: outputDir
        };
    }

    static buildExposureMaps(
        workflowInput: WorkflowDefinition | WorkflowGraph
    ): WorkflowExposureMaps {
        const workflow = workflowInput instanceof WorkflowGraph
            ? workflowInput
            : new WorkflowGraph(workflowInput);
        const exposuresByNodeId = new Map<string, AnalysisExposureDefinition>();
        const exportNodeToExposureNodeId = new Map<string, string>();

        for (const node of workflow.nodes) {
            if (node.type !== WorkflowNodeType.Exposure) {
                continue;
            }

            const exposureData = node.data.exposure!;
            const exportNode = workflow.findDescendantByType(node.id, WorkflowNodeType.Export);
            if (exportNode) {
                exportNodeToExposureNodeId.set(exportNode.id, node.id);
            }

            exposuresByNodeId.set(node.id, {
                nodeId: node.id,
                name: exposureData.name!,
                results: exposureData.results!,
                export: exportNode ? exportNode.data.export : undefined
            });
        }

        return {
            exposuresByNodeId,
            exportNodeToExposureNodeId
        };
    }

    static collectExposureDefinitions(
        workflowInput: WorkflowDefinition | WorkflowGraph
    ): AnalysisExposureDefinition[] {
        return Array.from(WorkflowSession.buildExposureMaps(workflowInput).exposuresByNodeId.values());
    }

    constructor(readonly context: WorkflowExecutionContext) {}

    get outputs(): WorkflowOutputs {
        return this.context.outputs;
    }

    snapshotOutputs(): WorkflowOutputsSnapshot {
        return WorkflowSession.snapshotOutputs(this.outputs);
    }

    getOutput(nodeId: string): WorkflowNodeOutput | undefined {
        return this.outputs.get(nodeId);
    }

    setOutput(nodeId: string, output: WorkflowNodeOutput): WorkflowNodeOutput {
        this.outputs.set(nodeId, output);
        return output;
    }

    resolveSelectedDump(): WorkflowDumpSelection | null {
        return WorkflowSession.resolveSelectedDump(this.context);
    }

    setForEachCurrentValue(
        currentValue: TrajectoryDumpDescriptor,
        currentIndex: number,
        outputDir: string
    ): void {
        const forEachNode = this.context.workflow.nodes.find((node) => node.type === WorkflowNodeType.ForEach);
        if (!forEachNode) {
            return;
        }

        const currentForEachOutput = this.outputs.get(forEachNode.id);
        this.outputs.set(forEachNode.id, {
            ...(currentForEachOutput ?? {}),
            currentValue,
            currentIndex,
            outputPath: outputDir
        });
    }

    applyLocalizedDumpSelection(
        selection: WorkflowDumpSelection,
        localPath: string,
        outputDir: string
    ): void {
        const localizedDump = WorkflowSession.createLocalDumpDescriptor(selection.dump, localPath);
        const contextNode = this.context.workflow.nodes.find((node) => node.type === WorkflowNodeType.Context);

        if (contextNode) {
            const currentContextOutput = this.outputs.get(contextNode.id);
            this.outputs.set(
                contextNode.id,
                WorkflowSession.createLocalizedContextOutput(currentContextOutput, localizedDump, outputDir)
            );
        }

        this.setForEachCurrentValue(localizedDump, selection.index, outputDir);
    }
}
