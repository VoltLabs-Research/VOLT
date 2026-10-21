import type { WorkflowExecutionContext, WorkflowNodeOutput } from '@shared/contracts/types/workflow.types';
import type { WorkflowNodeHandler, WorkflowNodeRegistry } from '@modules/analysis/services/workflow/NodeRegistry';
import { NodeType } from '@volt/contracts/modules/plugin/enums';
import type { IWorkflowNode } from '@volt/contracts/modules/plugin/workflow';

interface WorkflowForEachOutput {
    items: WorkflowNodeOutput[];
    count: number;
    currentValue: null;
    currentIndex: number;
}

export class WorkflowForEachHandler implements WorkflowNodeHandler {
    readonly type = NodeType.FOREACH;

    constructor(private readonly registry: WorkflowNodeRegistry) {}

    execute(node: IWorkflowNode, context: WorkflowExecutionContext): Promise<WorkflowForEachOutput> {
        const rawRef = node.data.forEach?.iterableSource;
        if (!rawRef) {
            throw new Error('ForEach iterable source is required');
        }

        const cleanRef = rawRef.replace(/^\{\{\s*|\s*\}\}$/g, '');
        const items = this.registry.createValueResolver(context, node.id).resolveReference(cleanRef);
        if (!Array.isArray(items)) {
            const availableNodes = Array.from(context.outputs.keys()).join(', ');
            throw new Error(
                `ForEach iterable source is invalid: "${cleanRef}" resolved to ${typeof items}. Available nodes: [${availableNodes}]`
            );
        }

        return Promise.resolve({
            items,
            count: items.length,
            currentValue: null,
            currentIndex: -1
        });
    }
};
