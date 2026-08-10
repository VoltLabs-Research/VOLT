import type { TrajectoryDumpDescriptor, WorkflowTrajectoryWindowData } from '@shared/contracts/types/http-workflow';
import type { WorkflowExecutionContext, WorkflowNode, WorkflowNodeOutput } from '@shared/contracts/types/workflow.types';
import { WorkflowNodeType } from '@shared/contracts/types/workflow.types';
import { WorkflowSession } from '@modules/analysis/services/workflow/WorkflowSession';
import type { WorkflowNodeHandler } from '@modules/analysis/services/workflow/NodeRegistry';

interface WorkflowTrajectoryWindowOutput extends WorkflowNodeOutput {
    frames: TrajectoryDumpDescriptor[];
    count: number;
    primaryIndex: number;
    primaryValue: TrajectoryDumpDescriptor | null;
    framePaths: string;
    framePathsCsv: string;
    outputPath: string | undefined;
}

export interface TrajectoryWindowPlanItem {
    primaryTimestep: number;
    windowTimesteps: number[];
}

const findTimestepIndex = (
    frames: TrajectoryDumpDescriptor[],
    selectedTimestep: number | undefined
): number => {
    if (selectedTimestep === undefined) {
        return 0;
    }

    const index = frames.findIndex((frame) => frame.timestep === selectedTimestep);
    return index >= 0 ? index : 0;
};

export class WorkflowTrajectoryWindowHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.TrajectoryWindow;

    static planItems(
        data: WorkflowTrajectoryWindowData,
        timesteps: number[]
    ): TrajectoryWindowPlanItem[] {
        if (timesteps.length === 0) {
            return [];
        }

        if (data.mode === 'all') {
            return [{
                primaryTimestep: timesteps[0],
                windowTimesteps: [...timesteps]
            }];
        }

        return timesteps.map((primaryTimestep, primaryIndex) => ({
            primaryTimestep,
            windowTimesteps: this.windowSliceTimesteps(data, timesteps, primaryIndex)
        }));
    }

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

        const frames = this.resolvePlanningFrames(data, context);
        const primaryIndex = this.resolvePrimaryIndex(data, frames, context.selectedTimestep);

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
        const slice = new Set(WorkflowTrajectoryWindowHandler.windowSliceTimesteps(
            data,
            dumps.map((dump) => dump.timestep),
            findTimestepIndex(dumps, context.selectedTimestep)
        ));
        return dumps.filter((dump) => slice.has(dump.timestep));
    }

    private resolvePrimaryIndex(
        data: WorkflowTrajectoryWindowData,
        frames: TrajectoryDumpDescriptor[],
        selectedTimestep: number | undefined
    ): number {
        return data.mode === 'referencePair'
            ? Math.max(0, frames.length - 1)
            : findTimestepIndex(frames, selectedTimestep);
    }
}
