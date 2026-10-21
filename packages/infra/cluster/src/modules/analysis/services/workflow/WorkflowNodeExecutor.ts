import type { WorkflowExecutionContext, WorkflowNodeOutput } from '@shared/contracts/types/workflow.types';
import type { WorkflowNodeRegistry } from '@modules/analysis/services/workflow/NodeRegistry';
import type { IWorkflowNode } from '@volt/contracts/modules/plugin/workflow';

interface WorkflowNodeExecutionResult {
    node: IWorkflowNode;
    status: 'executed' | 'skipped';
    output?: WorkflowNodeOutput;
    reason?: string;
}

export class WorkflowNodeExecutor {
    constructor(private readonly registry: WorkflowNodeRegistry) {}

    async executeNode(
        node: IWorkflowNode,
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
