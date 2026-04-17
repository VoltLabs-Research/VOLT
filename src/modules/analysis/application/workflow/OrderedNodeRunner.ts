import type { WorkflowExecutionContext, WorkflowNode, WorkflowNodeOutput } from '@/modules/analysis/contracts/workflow.types';
import type { WorkflowNodeRegistry } from '@/modules/analysis/application/workflow/NodeRegistry';

interface RunOrderedWorkflowNodesParams {
    nodes: WorkflowNode[];
    context: WorkflowExecutionContext;
    registry: WorkflowNodeRegistry;
    shouldSkipNode?: (node: WorkflowNode) => string | undefined;
    stopAfterNode?: (result: OrderedNodeExecutionResult) => boolean;
}

interface OrderedNodeExecutionResult {
    node: WorkflowNode;
    status: 'executed' | 'skipped';
    output?: WorkflowNodeOutput;
    reason?: string;
};

export const runOrderedWorkflowNodes = async (
    params: RunOrderedWorkflowNodesParams
): Promise<OrderedNodeExecutionResult[]> => {
    const results: OrderedNodeExecutionResult[] = [];

    for (const node of params.nodes) {
        if (!params.registry.has(node.type)) {
            const result: OrderedNodeExecutionResult = {
                node,
                status: 'skipped',
                reason: `No handler registered for node type "${node.type}"`
            };
            results.push(result);
            continue;
        }

        const skipReason = params.shouldSkipNode?.(node);
        if (skipReason) {
            const result: OrderedNodeExecutionResult = {
                node,
                status: 'skipped',
                reason: skipReason
            };
            results.push(result);
            continue;
        }

        const output = await params.registry.execute(node, params.context);
        const result: OrderedNodeExecutionResult = {
            node,
            output,
            status: 'executed'
        };
        results.push(result);

        if (params.stopAfterNode?.(result)) {
            break;
        }
    }

    return results;
};
