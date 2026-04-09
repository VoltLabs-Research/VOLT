import type { WorkflowNodeHandler, WorkflowNodeRegistry } from '../services';
import { WorkflowNodeType } from '../contracts';

export class WorkflowForEachHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.ForEach;
    readonly outputSchema = { properties: {} };

    constructor(
        private readonly registry: WorkflowNodeRegistry
    ) {}

    async execute(node: any, context: any): Promise<Record<string, unknown>> {
        const rawRef = node.data.forEach?.iterableSource;
        if (!rawRef) {
            throw new Error('ForEach iterable source is required');
        }

        const cleanRef = String(rawRef).replace(/^\{\{\s*|\s*\}\}$/g, '');
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
}
