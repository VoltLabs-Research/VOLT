import type { WorkflowExecutionContext, WorkflowNode } from '../contracts';
import type { WorkflowNodeHandler } from '../services';
import { WorkflowNodeType } from '../contracts';
import { logger } from '@/core/logger';

const resolveSelectedTrajectoryFrames = (context: WorkflowExecutionContext): Record<string, unknown>[] => {
    if (Array.isArray(context.trajectoryDumpOverrides) && context.trajectoryDumpOverrides.length > 0) {
        return context.trajectoryDumpOverrides.map((frame) => ({
            ...frame,
            path: frame.path
        }));
    }

    const allFrames = context.trajectoryFrames;
    let selected: typeof allFrames;

    if (context.selectedFrameOnly && typeof context.selectedTimestep === 'number') {
        selected = allFrames.filter((frame) => frame.timestep === context.selectedTimestep);
    } else if (context.selectedTimesteps?.length) {
        const selectedTimestepsSet = new Set(context.selectedTimesteps);
        selected = allFrames.filter((frame) => selectedTimestepsSet.has(frame.timestep));
    } else {
        selected = allFrames;
    }

    return selected.map((frame) => ({
        ...frame,
        path: `trajectory-${context.trajectoryId}/timestep-${String(frame.timestep)}.dump.zst`
    }));
};

export class WorkflowContextHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.Context;
    readonly outputSchema = { properties: {} };

    async execute(_node: WorkflowNode, context: WorkflowExecutionContext): Promise<Record<string, unknown>> {
        const dumps = resolveSelectedTrajectoryFrames(context);

        logger.info(
            { framesCount: dumps.length, totalAvailable: context.trajectoryFrames.length },
            '@context-handler: planning trajectory_dumps'
        );

        return {
            trajectory_dumps: dumps,
            count: dumps.length,
            trajectory: { _id: context.trajectoryId, frames: dumps }
        };
    }
}
