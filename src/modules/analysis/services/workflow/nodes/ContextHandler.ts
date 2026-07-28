import { WORKFLOW_NODE_PHASE, type WorkflowNodeHandler } from '@modules/analysis/services/workflow/NodeRegistry';
import type { WorkflowExecutionContext, WorkflowNode, WorkflowNodeOutput } from '@shared/contracts/types/workflow.types';
import { WorkflowSession } from '@modules/analysis/services/workflow/WorkflowSession';
import { WorkflowNodeType } from '@shared/contracts/types/workflow.types';

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
    readonly phase = WORKFLOW_NODE_PHASE[WorkflowNodeType.Context];

    execute(_node: WorkflowNode, context: WorkflowExecutionContext): Promise<WorkflowContextOutput> {
        const dumps = WorkflowSession.resolveContextDumps(context);

        return Promise.resolve({
            trajectory_dumps: dumps,
            count: dumps.length,
            trajectory: { _id: context.trajectoryId, frames: dumps }
        });
    }
}
