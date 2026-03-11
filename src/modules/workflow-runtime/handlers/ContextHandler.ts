import type { WorkflowExecutionContext, WorkflowNode } from '../contracts';
import type { WorkflowNodeHandler } from '../services';
import { WorkflowNodeType } from '../contracts';
import { logger } from '@/core/logger';

const resolveSelectedTrajectoryFrames = (context: WorkflowExecutionContext): Record<string, unknown>[] => {
    const allFrames = context.trajectoryFrames;

    if (context.selectedFrameOnly && typeof context.selectedTimestep === 'number') {
        return allFrames.filter((frame) => frame.timestep === context.selectedTimestep);
    }

    if (context.selectedTimesteps?.length) {
        const selectedTimestepsSet = new Set(context.selectedTimesteps);
        return allFrames.filter((frame) => selectedTimestepsSet.has(frame.timestep));
    }

    return allFrames;
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
