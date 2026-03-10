import type { WorkflowNodeHandler } from '../services';
import { WorkflowNodeType } from '../contracts';
import { logger } from '../../../core/logger';

export class WorkflowContextHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.Context;
    readonly outputSchema = { properties: {} };

    async execute(_node: any, context: any): Promise<Record<string, unknown>> {
        const allFrames = Array.isArray(context.trajectoryFrames) ? context.trajectoryFrames : [];

        let dumps: Record<string, unknown>[];
        if (context.selectedFrameOnly && context.selectedTimestep != null) {
            dumps = allFrames.filter(
                (f: Record<string, unknown>) => f.timestep === context.selectedTimestep || f.frame === context.selectedTimestep
            );
        } else {
            dumps = allFrames;
        }

        logger.info(
            { framesCount: dumps.length, totalAvailable: allFrames.length },
            '@context-handler: planning trajectory_dumps'
        );

        return {
            trajectory_dumps: dumps,
            count: dumps.length,
            trajectory: { _id: context.trajectoryId, frames: allFrames }
        };
    }
}
