import type { WorkflowNodeHandler } from '@/modules/analysis/application/workflow/NodeRegistry';
import type { WorkflowExecutionContext, WorkflowNode, WorkflowNodeOutput } from '@/modules/analysis/contracts/workflow.types';
import { WorkflowSession } from '@/modules/analysis/application/workflow/WorkflowSession';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';

interface WorkflowContextOutput extends WorkflowNodeOutput {
    trajectory_dumps: ReturnType<typeof WorkflowSession.resolveContextDumps>;
    count: number;
    trajectory: {
        _id: string;
        frames: ReturnType<typeof WorkflowSession.resolveContextDumps>;
    };
}

export class WorkflowContextHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.Context;

    execute(_node: WorkflowNode, context: WorkflowExecutionContext): Promise<WorkflowContextOutput> {
        const dumps = WorkflowSession.resolveContextDumps(context);

        return Promise.resolve({
            trajectory_dumps: dumps,
            count: dumps.length,
            trajectory: { _id: context.trajectoryId, frames: dumps }
        });
    }
}
