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
        const items = this.registry.resolveReference(cleanRef, context);
        if (!Array.isArray(items)) {
            throw new Error('ForEach iterable source is invalid');
        }

        return {
            items,
            count: items.length,
            currentValue: null,
            currentIndex: -1
        };
    }
}
