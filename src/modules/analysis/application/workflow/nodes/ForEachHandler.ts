import type { WorkflowExecutionContext, WorkflowNode } from '@/modules/analysis/contracts/workflow.types';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import type { WorkflowNodeHandler, WorkflowNodeRegistry } from '@/modules/analysis/application/workflow';

export class WorkflowForEachHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.ForEach;

    constructor(
        private readonly registry: WorkflowNodeRegistry
    ) {}

    async execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<Record<string, unknown>> {
        const rawRef = node.data.forEach?.iterableSource;
        if (!rawRef) {
            throw new Error('ForEach iterable source is required');
        }

        const cleanRef = rawRef.replace(/^\{\{\s*|\s*\}\}$/g, '');
        const items = this.registry.resolveReference(cleanRef, context, node.id);
        if (!Array.isArray(items)) {
            const availableNodes = Array.from(context.outputs.keys()).join(', ');
            throw new Error(
                `ForEach iterable source is invalid: "${cleanRef}" resolved to ${typeof items}. Available nodes: [${availableNodes}]`
            );
        }

        return {
            items,
            count: items.length,
            currentValue: null,
            currentIndex: -1
        };
    }
};
