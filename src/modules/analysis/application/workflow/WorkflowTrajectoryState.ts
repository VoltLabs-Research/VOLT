import type { TrajectoryDumpDescriptor } from '@/contracts';
import type { WorkflowExecutionContext, WorkflowNodeOutput } from '@/modules/analysis/contracts/workflow.types';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';

interface WorkflowDumpSelection {
    dump: TrajectoryDumpDescriptor;
    index: number;
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

export const resolveWorkflowContextDumps = (
    context: WorkflowExecutionContext
): TrajectoryDumpDescriptor[] => {
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

    const selectedFrames = context.selectedFrameOnly && typeof context.selectedTimestep === 'number'
        ? context.trajectoryFrames.filter((frame) => frame.timestep === context.selectedTimestep)
        : selectedTimesteps
            ? context.trajectoryFrames.filter((frame) => selectedTimesteps.has(frame.timestep))
            : context.trajectoryFrames;

    return selectedFrames.map((frame) => ({
        ...frame,
        path: `trajectory-${context.trajectoryId}/timestep-${frame.timestep}.dump.zst`
    }));
};

export const resolveWorkflowSelectedDump = (
    context: WorkflowExecutionContext
): WorkflowDumpSelection | null => {
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
};

export const createLocalWorkflowDumpDescriptor = (
    dump: TrajectoryDumpDescriptor,
    localPath: string,
    options: { originalPath?: string } = {}
): TrajectoryDumpDescriptor => {
    const useExplicitOriginalPath = Object.prototype.hasOwnProperty.call(options, 'originalPath');

    return {
        ...dump,
        path: localPath,
        originalPath: useExplicitOriginalPath
            ? options.originalPath
            : dump.originalPath ?? dump.path
    };
};

export const createLocalizedWorkflowContextOutput = (
    contextOutput: WorkflowNodeOutput | undefined,
    localizedDump: TrajectoryDumpDescriptor,
    outputDir: string
): WorkflowNodeOutput => {
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
};

export const setWorkflowForEachCurrentValue = (
    context: WorkflowExecutionContext,
    currentValue: TrajectoryDumpDescriptor,
    currentIndex: number,
    outputDir: string
): void => {
    const forEachNode = context.workflow.nodes.find((node) => node.type === WorkflowNodeType.ForEach);
    if (!forEachNode) {
        return;
    }

    const currentForEachOutput = context.outputs.get(forEachNode.id);
    context.outputs.set(forEachNode.id, {
        ...(currentForEachOutput ?? {}),
        currentValue,
        currentIndex,
        outputPath: outputDir
    });
};

export const applyLocalizedWorkflowDumpSelection = (
    context: WorkflowExecutionContext,
    selection: WorkflowDumpSelection,
    localPath: string,
    outputDir: string
): void => {
    const localizedDump = createLocalWorkflowDumpDescriptor(selection.dump, localPath);
    const contextNode = context.workflow.nodes.find((node) => node.type === WorkflowNodeType.Context);

    if (contextNode) {
        const currentContextOutput = context.outputs.get(contextNode.id);
        context.outputs.set(
            contextNode.id,
            createLocalizedWorkflowContextOutput(currentContextOutput, localizedDump, outputDir)
        );
    }

    setWorkflowForEachCurrentValue(context, localizedDump, selection.index, outputDir);
};
