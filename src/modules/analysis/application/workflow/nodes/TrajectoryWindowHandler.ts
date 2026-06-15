import type { TrajectoryDumpDescriptor, WorkflowTrajectoryWindowData } from '@/modules/analysis/contracts/http-workflow';
import type { WorkflowExecutionContext, WorkflowNode, WorkflowNodeOutput } from '@/modules/analysis/contracts/workflow.types';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import { WorkflowSession } from '@/modules/analysis/application/workflow/WorkflowSession';
import { WORKFLOW_NODE_PHASE, type WorkflowNodeHandler } from '@/modules/analysis/application/workflow/NodeRegistry';

interface WorkflowTrajectoryWindowOutput extends WorkflowNodeOutput {
    frames: TrajectoryDumpDescriptor[];
    count: number;
    primaryIndex: number;
    primaryValue: TrajectoryDumpDescriptor | null;
    framePaths: string;
    framePathsCsv: string;
    outputPath: string | undefined;
}

// One materialized job for a window plugin: the primary frame plus the window of
// timesteps that frame is processed with. `mode: 'all'` yields a single item
// carrying every timestep; `window`/`referencePair` yield one item per primary
// frame, each with its own slice.
export interface TrajectoryWindowPlanItem {
    primaryTimestep: number;
    windowTimesteps: number[];
}

/**
 * Resolves the set of trajectory dumps a multi-frame plugin consumes. The
 * windowing math (mode slicing + end clamping) lives here as the single tested
 * source of truth, reused by the planner fan-out
 * ({@link WorkflowTrajectoryWindowHandler.planItems}) and by per-job execution.
 * The handler does NOT download — it resolves descriptors only; the
 * AnalysisEnvironment localizes paths and seeds the node output per job.
 */
export class WorkflowTrajectoryWindowHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.TrajectoryWindow;
    readonly phase = WORKFLOW_NODE_PHASE[WorkflowNodeType.TrajectoryWindow];

    // Planner fan-out: maps the ordered trajectory timesteps to one or more jobs.
    static planItems(
        data: WorkflowTrajectoryWindowData,
        timesteps: number[]
    ): TrajectoryWindowPlanItem[] {
        if (timesteps.length === 0) {
            return [];
        }

        if (data.mode === 'all') {
            return [{ primaryTimestep: timesteps[0], windowTimesteps: [...timesteps] }];
        }

        return timesteps.map((primaryTimestep, primaryIndex) => ({
            primaryTimestep,
            windowTimesteps: this.windowSliceTimesteps(data, timesteps, primaryIndex)
        }));
    }

    // The window of timesteps for one primary frame (by its index in the ordered
    // trajectory). Centered windows clamp at the ends; referencePair returns the
    // [reference, primary] pair.
    static windowSliceTimesteps(
        data: WorkflowTrajectoryWindowData,
        timesteps: number[],
        primaryIndex: number
    ): number[] {
        if (data.mode === 'all') {
            return [...timesteps];
        }

        if (data.mode === 'referencePair') {
            const referenceTimestep = data.referenceTimestep ?? timesteps[0];
            const primaryTimestep = timesteps[primaryIndex] ?? timesteps[0];
            return referenceTimestep === primaryTimestep
                ? [primaryTimestep]
                : [referenceTimestep, primaryTimestep];
        }

        const windowSize = Math.min(Math.max(1, data.windowSize ?? 1), timesteps.length);
        const centered = data.centered !== false;
        const start = centered
            ? primaryIndex - Math.floor(windowSize / 2)
            : primaryIndex - (windowSize - 1);
        const clampedStart = Math.max(0, Math.min(start, timesteps.length - windowSize));
        return timesteps.slice(clampedStart, clampedStart + windowSize);
    }

    execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<WorkflowTrajectoryWindowOutput> {
        const data = node.data.trajectoryWindow;
        if (!data?.mode) {
            throw new Error(`TrajectoryWindow node ${node.id} requires a window mode`);
        }

        // Runtime: AnalysisEnvironment seeds context.windowFrames with the
        // localized dumps for the current job; during planning the override is
        // absent and we resolve descriptors from the full context dump set.
        const localized = context.windowFrames?.length ? context.windowFrames : null;
        const frames = localized ?? this.resolvePlanningFrames(data, context);
        const primaryIndex = context.primaryFrameIndex !== undefined
            ? Math.max(0, Math.min(context.primaryFrameIndex, frames.length - 1))
            : this.resolvePrimaryIndex(data, frames, context.selectedTimestep);

        return Promise.resolve({
            frames,
            count: frames.length,
            primaryIndex,
            primaryValue: frames[primaryIndex] ?? null,
            framePaths: frames.map((frame) => frame.path).join(' '),
            framePathsCsv: frames.map((frame) => frame.path).join(','),
            outputPath: context.outputs.get(node.id)?.outputPath as string | undefined
        });
    }

    private resolvePlanningFrames(
        data: WorkflowTrajectoryWindowData,
        context: WorkflowExecutionContext
    ): TrajectoryDumpDescriptor[] {
        const dumps = WorkflowSession.resolveContextDumps(context);
        const timesteps = dumps.map((dump) => dump.timestep);
        const primaryIndex = this.findPrimaryDumpIndex(dumps, context.selectedTimestep);
        const slice = WorkflowTrajectoryWindowHandler.windowSliceTimesteps(data, timesteps, primaryIndex);
        const sliceSet = new Set(slice);
        return dumps.filter((dump) => sliceSet.has(dump.timestep));
    }

    private resolvePrimaryIndex(
        data: WorkflowTrajectoryWindowData,
        frames: TrajectoryDumpDescriptor[],
        selectedTimestep: number | undefined
    ): number {
        if (data.mode === 'referencePair') {
            // [reference, primary] — the primary frame is the last entry.
            return Math.max(0, frames.length - 1);
        }

        if (selectedTimestep !== undefined) {
            const matched = frames.findIndex((frame) => frame.timestep === selectedTimestep);
            if (matched >= 0) {
                return matched;
            }
        }

        return 0;
    }

    private findPrimaryDumpIndex(
        dumps: TrajectoryDumpDescriptor[],
        selectedTimestep: number | undefined
    ): number {
        if (selectedTimestep === undefined) {
            return 0;
        }
        const index = dumps.findIndex((dump) => dump.timestep === selectedTimestep);
        return index >= 0 ? index : 0;
    }
}
