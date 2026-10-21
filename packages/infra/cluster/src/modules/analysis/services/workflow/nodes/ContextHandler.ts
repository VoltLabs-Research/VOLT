import type { WorkflowNodeHandler } from '@modules/analysis/services/workflow/NodeRegistry';
import type { WorkflowExecutionContext, WorkflowNodeOutput } from '@shared/contracts/types/workflow.types';
import { WorkflowSession } from '@modules/analysis/services/workflow/WorkflowSession';
import { NodeType } from '@volt/contracts/modules/plugin/enums';
import type { IWorkflowNode } from '@volt/contracts/modules/plugin/workflow';

interface WorkflowContextOutput extends WorkflowNodeOutput {
    trajectory_dumps: ReturnType<typeof WorkflowSession.resolveContextDumps>;
    count: number;
    trajectory: {
        _id: string;
        frames: ReturnType<typeof WorkflowSession.resolveContextDumps>;
    };
}

export class WorkflowContextHandler implements WorkflowNodeHandler {
    readonly type = NodeType.CONTEXT;

    execute(_node: IWorkflowNode, context: WorkflowExecutionContext): Promise<WorkflowContextOutput> {
        const dumps = WorkflowSession.resolveContextDumps(context);

        return Promise.resolve({
            trajectory_dumps: dumps,
            count: dumps.length,
            trajectory: {
                _id: context.trajectoryId,
                frames: dumps
            }
        });
    }
}
