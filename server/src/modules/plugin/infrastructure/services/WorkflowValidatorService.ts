import { injectable } from 'tsyringe';
import { WorkflowProps } from '@modules/plugin/domain/entities/workflow/Workflow';
import { WorkflowNode, WorkflowNodeType } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
import { WorkflowEdge } from '@modules/plugin/domain/entities/workflow/WorkflowEdge';
import { IWorkflowValidatorService, WorkflowValidationResult } from '@modules/plugin/domain/port/IWorkflowValidatorService';

@injectable()
export class WorkflowValidatorService implements IWorkflowValidatorService {
    validate(workflow: WorkflowProps): WorkflowValidationResult {
        const errors: string[] = [];
        let modifier: WorkflowNode | undefined;

        if (!workflow || !workflow.nodes || !Array.isArray(workflow.nodes)) {
            errors.push('Workflow must have a nodes array');
            return { isValid: false, errors };
        }

        const modifierNode = workflow.nodes.find((node) => node.type === WorkflowNodeType.Modifier);
        if (!modifierNode) {
            errors.push('Workflow must have a modifier node');
        } else {
            modifier = modifierNode;
        }

        if (!workflow.edges || !Array.isArray(workflow.edges)) {
            errors.push('Workflow must have edges array');
        }

        const nodeIds = new Set(workflow.nodes.map((node) => node.id));
        for (const edge of workflow.edges || []) {
            if (!nodeIds.has(edge.source)) {
                errors.push(`Edge references unknown source node: ${edge.source}`);
            }
            if (!nodeIds.has(edge.target)) {
                errors.push(`Edge references unknown target node: ${edge.target}`);
            }
        }

        if (workflow.nodes.length > 0 && workflow.edges?.length > 0) {
            if (this.hasCycle(workflow.nodes, workflow.edges)) {
                errors.push('Workflow contains a cycle');
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            modifier
        };
    }

    private hasCycle(nodes: WorkflowNode[], edges: WorkflowEdge[]): boolean {
        const adjacency = new Map<string, string[]>();
        for (const node of nodes) {
            adjacency.set(node.id, []);
        }

        for (const edge of edges) {
            adjacency.get(edge.source)?.push(edge.target);
        }

        const visited = new Set<string>();
        const stack = new Set<string>();

        const dfs = (nodeId: string): boolean => {
            visited.add(nodeId);
            stack.add(nodeId);

            for (const neighbor of adjacency.get(nodeId) || []) {
                if (!visited.has(neighbor)) {
                    if (dfs(neighbor)) return true;
                } else if (stack.has(neighbor)) {
                    return true;
                }
            }

            stack.delete(nodeId);
            return false;
        };

        for (const node of nodes) {
            if (!visited.has(node.id)) {
                if (dfs(node.id)) return true;
            }
        }

        return false;
    }
}
