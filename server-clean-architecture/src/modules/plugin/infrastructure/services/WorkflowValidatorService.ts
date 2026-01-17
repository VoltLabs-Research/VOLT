import { injectable } from 'tsyringe';

@injectable()
export class WorkflowValidatorService {
    validate(workflow: any): { isValid: boolean; errors?: string[]; modifier?: any } {
        const errors: string[] = [];
        let modifier = null;

        // Check if workflow has nodes
        if (!workflow || !workflow.nodes || !Array.isArray(workflow.nodes)) {
            errors.push('Workflow must have a nodes array');
            return { isValid: false, errors };
        }

        // Check for modifier node
        const modifierNode = workflow.nodes.find((n: any) => n.type === 'modifier');
        if (!modifierNode) {
            errors.push('Workflow must have a modifier node');
        } else {
            modifier = modifierNode;
        }

        // Check for connections
        if (!workflow.edges || !Array.isArray(workflow.edges)) {
            errors.push('Workflow must have edges array');
        }

        // Validate node connections
        const nodeIds = new Set(workflow.nodes.map((n: any) => n.id));
        for (const edge of workflow.edges || []) {
            if (!nodeIds.has(edge.source)) {
                errors.push(`Edge references unknown source node: ${edge.source}`);
            }
            if (!nodeIds.has(edge.target)) {
                errors.push(`Edge references unknown target node: ${edge.target}`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            modifier
        };
    }
}
