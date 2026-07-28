import type {
    WorkflowExecutionContext,
    WorkflowNode,
    WorkflowNodeOutput
} from '@shared/contracts/types/workflow.types';
import type { WorkflowNodeRegistry } from '@modules/analysis/services/workflow/NodeRegistry';

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
        context: WorkflowExecutionContext
    ): Promise<WorkflowNodeExecutionResult> {
        if (!this.registry.has(node.type)) {
            return {
                node,
                status: 'skipped',
                reason: `No handler registered for node type "${node.type}"`
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
