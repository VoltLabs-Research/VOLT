import type {
    WorkflowExecutionContext,
    WorkflowNode,
    WorkflowNodeOutput
} from '@/modules/analysis/contracts/workflow.types';
import type { WorkflowNodeRegistry } from '@/modules/analysis/application/workflow/NodeRegistry';

export interface WorkflowNodeExecutionResult {
    node: WorkflowNode;
    status: 'executed' | 'skipped';
    output?: WorkflowNodeOutput;
    reason?: string;
}

export class WorkflowNodeExecutor {
    constructor(private readonly registry: WorkflowNodeRegistry) {}

    async executeNode(
        node: WorkflowNode,
        context: WorkflowExecutionContext,
        shouldSkipNode?: (node: WorkflowNode) => string | undefined
    ): Promise<WorkflowNodeExecutionResult> {
        if (!this.registry.has(node.type)) {
            return {
                node,
                status: 'skipped',
                reason: `No handler registered for node type "${node.type}"`
            };
        }

        const skipReason = shouldSkipNode?.(node);
        if (skipReason) {
            return {
                node,
                status: 'skipped',
                reason: skipReason
            };
        }

        const output = await this.registry.execute(node, context);
        return {
            node,
            output,
            status: 'executed'
        };
    }
}
