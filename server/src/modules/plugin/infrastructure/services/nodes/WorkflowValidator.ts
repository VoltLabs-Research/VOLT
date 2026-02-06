import { injectable } from 'tsyringe';
import { IWorkflowValidator, ValidationResult } from '@modules/plugin/domain/ports/INodeRegistry';
import { WorkflowNodeType, WorkflowNode } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
import Workflow from '@modules/plugin/domain/entities/workflow/Workflow';

@injectable()
export default class WorkflowValidator implements IWorkflowValidator{
    public validateStructure(workflow: Workflow): ValidationResult{
        const errors: string[] = [];
        if(!workflow.props.nodes || workflow.props.nodes.length === 0){
            errors.push('Workflow must have at least one node');
            return { valid: false, errors };
        }

        const requiredNodesResult = this.validateRequiredNodes(workflow);
        errors.push(...requiredNodesResult.errors);

        for(const node of workflow.props.nodes){
            const nodeResult = this.validateNodeData(node);
            errors.push(...nodeResult.errors);
        }

        if(this.hasCycle(workflow)){
            errors.push('Workflow contains a cycle');
        }

        return {
            valid: errors.length === 0, 
            errors
        };
    }

    public validateRequiredNodes(workflow: Workflow): ValidationResult{
        const errors: string[] = [];
        const nodeTypes = workflow.props.nodes.map((node: WorkflowNode) => node.type);
        if(!nodeTypes.includes(WorkflowNodeType.Modifier)){
            errors.push('Workflow must have a Modifier node');
        }

        if(!nodeTypes.includes(WorkflowNodeType.Entrypoint)){
            errors.push('Workflow mus thave an Entrypoint mode');
        }

        if(!nodeTypes.includes(WorkflowNodeType.Exposure)){
            errors.push('Workflow must have at least one Exposure node');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    public validateNodeData(node: WorkflowNode): ValidationResult{
        const errors: string[] = [];
        switch(node.type){
            case WorkflowNodeType.Modifier:
                if(!node?.data?.modifier?.name){
                    errors.push('Modifier node must have a name');
                }
                break;

            case WorkflowNodeType.Entrypoint:
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

        return {
            valid: errors.length === 0,
            errors
        };
    }

    public hasCycle(workflow: Workflow): boolean{
        const adjacency = new Map<string, string[]>();
        for(const node of workflow.props.nodes){
            adjacency.set(node.id, []);
        }

        for(const edge of workflow.props.edges){
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

        for(const node of workflow.props.nodes){
            if(!visited.has(node.id)){
                if(dfs(node.id)) return true;
            }
        }

        return false;
    }
};
