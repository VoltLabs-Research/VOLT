import { WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import Workflow from '@modules/plugin/domain/entities/plugin/workflow/Workflow';

export const resolveModifierName = (workflow: Workflow, fallback: string = ''): string => {
    const modifierNode = workflow.props.nodes.find(
        (node) => node.type === WorkflowNodeType.Modifier
    );
    const name = modifierNode?.data?.modifier?.name;
    if (typeof name === 'string' && name.trim().length > 0) {
        return name.trim();
    }
    return fallback;
};
