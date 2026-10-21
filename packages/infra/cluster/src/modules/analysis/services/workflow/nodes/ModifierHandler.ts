import type { WorkflowExecutionContext, WorkflowNodeOutput } from '@shared/contracts/types/workflow.types';
import type { WorkflowNodeHandler } from '@modules/analysis/services/workflow/NodeRegistry';
import { NodeType } from '@volt/contracts/modules/plugin/enums';
import type { IWorkflowNode } from '@volt/contracts/modules/plugin/workflow';

interface WorkflowModifierOutput extends WorkflowNodeOutput {
    pluginId: string;
    trajectory: {
        _id: string;
        frames: WorkflowExecutionContext['trajectoryFrames'];
    };
    analysis: WorkflowExecutionContext['analysis'];
}

export class WorkflowModifierHandler implements WorkflowNodeHandler {
    readonly type = NodeType.MODIFIER;

    execute(node: IWorkflowNode, context: WorkflowExecutionContext): Promise<WorkflowModifierOutput> {
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
