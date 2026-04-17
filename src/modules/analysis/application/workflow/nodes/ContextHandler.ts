import type { WorkflowNodeHandler } from '@/modules/analysis/application/workflow/NodeRegistry';
import type { WorkflowExecutionContext, WorkflowNode, WorkflowNodeOutput } from '@/modules/analysis/contracts/workflow.types';
import { resolveWorkflowContextDumps } from '@/modules/analysis/application/workflow/WorkflowTrajectoryState';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import { logger } from '@/core/logger';

interface WorkflowContextOutput extends WorkflowNodeOutput {
    trajectory_dumps: ReturnType<typeof resolveWorkflowContextDumps>;
    count: number;
    trajectory: {
        _id: string;
        frames: ReturnType<typeof resolveWorkflowContextDumps>;
    };
}

export class WorkflowContextHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.Context;

    execute(_node: WorkflowNode, context: WorkflowExecutionContext): Promise<WorkflowContextOutput> {
        const dumps = resolveWorkflowContextDumps(context);

        logger.info(
            { framesCount: dumps.length, totalAvailable: context.trajectoryFrames.length },
            '@context-handler: planning trajectory_dumps'
        );

        return Promise.resolve({
            trajectory_dumps: dumps,
            count: dumps.length,
            trajectory: { _id: context.trajectoryId, frames: dumps }
        });
    }
}
