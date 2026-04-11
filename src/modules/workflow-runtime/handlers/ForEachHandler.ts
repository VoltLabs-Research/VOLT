import { isRecord } from '@/shared/utils';
import type { WorkflowExecutionContext, WorkflowNode } from '../contracts';
import { WorkflowNodeType } from '../contracts';
import type { WorkflowNodeHandler, WorkflowNodeRegistry } from '../services';

interface WorkflowForEachData {
    iterableSource?: string;
};

const readForEachData = (node: WorkflowNode): WorkflowForEachData => {
    if (!isRecord(node.data.forEach)) {
        return {};
    }

    return {
        iterableSource: typeof node.data.forEach.iterableSource === 'string'
            ? node.data.forEach.iterableSource
            : undefined
    };
};

export class WorkflowForEachHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.ForEach;
    readonly outputSchema = { properties: {} };

    constructor(
        private readonly registry: WorkflowNodeRegistry
    ) {}

    async execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<Record<string, unknown>> {
        const rawRef = readForEachData(node).iterableSource;
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
};
