import { IWorkflow, IWorkflowNode } from '@/types/models/modifier';
import { NodeType } from '@/types/models/plugin';

export interface ValidationResult{
    valid: boolean;
    errors: string[];
};

/**
 * Service for validating plugin workflow structures
 */
class WorkflowValidator{
    /**
     * Validate complete workflow structure
     */
    public validateStructure(workflow: IWorkflow): ValidationResult{
        const errors: string[] = [];
        if(!workflow.nodes || workflow.nodes.length === 0){
            errors.push('Workflow must have at least one node');
            return { valid: false, errors };
        }

        const requiredNodesResult = this.validateRequiredNodes(workflow);
        errors.push(...requiredNodesResult.errors);

        for(const node of workflow.nodes){
            const nodeResult = this.validateNodeData(node);
            errors.push(...nodeResult.errors);
        }

        if(this.hasCycle(workflow)){
            errors.push('Workflow contains a cycle');
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Validate that workflow has all required node types
     */
    public validateRequiredNodes(workflow: IWorkflow): ValidationResult{
        const errors: string[] = [];
        const nodeTypes = workflow.nodes.map((node: IWorkflowNode) => node.type);

        if(!nodeTypes.includes(NodeType.MODIFIER)){
            errors.push('Workflow must have a Modifier node');
        }

        if(!nodeTypes.includes(NodeType.ENTRYPOINT)){
            errors.push('Workflow must have an Entrypoint node');
        }

        if(!nodeTypes.includes(NodeType.EXPOSURE)){
            errors.push('Workflow must have at least one Exposure node');
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Validate individual node data based on its type
     */
    public validateNodeData(node: IWorkflowNode): ValidationResult{
        const errors: string[] = [];
        switch(node.type){
            case NodeType.MODIFIER:
                if(!node?.data?.modifier?.name){
                    errors.push('Modifier node must have a name');
                }
                break;
            
            case NodeType.ENTRYPOINT:
                if(!node?.data?.entrypoint?.binary){
                    errors.push('Entrypoint node must have a binary path');
                }

                if(!node?.data?.entrypoint?.arguments){
                    errors.push('Entrypoint node must have arguments template');
                }
                break;

            default:
                break;
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Check for cycles
     */
    public hasCycle(workflow: IWorkflow): boolean{
        const adjacency = new Map<string, string[]>();
        for(const node of workflow.nodes){
            adjacency.set(node.id, []);
        }

        for(const edge of workflow.edges){
            adjacency.get(edge.source)?.push(edge.target);
        }

        const visited = new Set<string>();
        const stack = new Set<string>();

        const dfs = (nodeId: string): boolean => {
            visited.add(nodeId);
            stack.add(nodeId);

            for(const neighbor of adjacency.get(nodeId) || []){
                if(!visited.has(neighbor)){
                    if(dfs(neighbor)) return true;
                }else if(stack.has(neighbor)){
                    return true;
                }
            }

            stack.delete(nodeId);
            return false;
        };

        for(const node of workflow.nodes){
            if(!visited.has(node.id)){
                if(dfs(node.id)) return true;
            }
        }

        return false;
    }
};

const workflowValidator = new WorkflowValidator();

export default workflowValidator;