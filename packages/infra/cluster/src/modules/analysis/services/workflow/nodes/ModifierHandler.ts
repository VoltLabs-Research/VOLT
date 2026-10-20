import type { WorkflowExecutionContext, WorkflowNode, WorkflowNodeOutput } from '@shared/contracts/types/workflow.types';
import type { WorkflowNodeHandler } from '@modules/analysis/services/workflow/NodeRegistry';
import { WorkflowNodeType } from '@shared/contracts/types/workflow.types';

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
