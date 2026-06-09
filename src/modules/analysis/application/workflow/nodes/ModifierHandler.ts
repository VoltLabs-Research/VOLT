import type { WorkflowExecutionContext, WorkflowNode, WorkflowNodeOutput } from '@/modules/analysis/contracts/workflow.types';
import { WORKFLOW_NODE_PHASE, type WorkflowNodeHandler } from '@/modules/analysis/application/workflow/NodeRegistry';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';

interface WorkflowModifierOutput extends WorkflowNodeOutput {
    pluginId: string;
    trajectory: {
        _id: string;
        frames: WorkflowExecutionContext['trajectoryFrames'];
    };
    analysis: WorkflowExecutionContext['analysis'];
}

export class WorkflowModifierHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.Modifier;
    readonly phase = WORKFLOW_NODE_PHASE[WorkflowNodeType.Modifier];

    execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<WorkflowModifierOutput> {
        const modifier = node.data.modifier;

        return Promise.resolve({
            ...modifier,
            pluginId: context.pluginId,
            trajectory: {
                _id: context.trajectoryId,
                frames: context.trajectoryFrames
            },
            analysis: context.analysis
        });
    }
};
