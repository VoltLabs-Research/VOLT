import { NodeType } from '@/models/plugin';
import { IWorkflow, IWorkflowNode } from '@/types/models/modifier';
import logger from '@/logger';

/**
 * Find immediate parent node of specified type
 */
export const findParentByType = (nodeId: string, workflow: IWorkflow, type: NodeType): IWorkflowNode | null => {
    const parentEdge = workflow.edges.find((edge) => edge.target === nodeId);
    if(!parentEdge) return null;

    const parentNode= workflow.nodes.find((node) => node.id === parentEdge.source);
    if(parentNode?.type === type) return parentNode;

    return findParentByType(parentEdge.source, workflow, type);
};

/**
 * Find any ancestor node of specified type (BFS)
 */
export const findAncestorByType = (nodeId: string, workflow: IWorkflow, type: NodeType): IWorkflowNode | null => {
    const visited = new Set<string>();
    const queue = [nodeId];

    while(queue.length > 0){
        const currentId = queue.shift()!;
        if(visited.has(currentId)) continue;
        visited.add(currentId);

        const parentEdges = workflow.edges.filter((edge) => edge.target === currentId);
        for(const edge of parentEdges){
            const parentNode = workflow.nodes.find((node) => node.id === edge.source);
            if(parentNode?.type === type) return parentNode;
            queue.push(edge.source);
        }
    }

    return null;
};

/**
 * Find immediate child node of specified type
 */
export const findChildByType = (nodeId: string, workflow: IWorkflow, type: NodeType): IWorkflowNode | null => {
    const childEdges = workflow.edges.filter((edge) => edge.source === nodeId);
    for(const edge of childEdges){
        const childNode= workflow.nodes.find((node) => node.id === edge.target);
        if(childNode?.type === type) return childNode;
    }
    return null;
};

/**
 * Find descendant node of specified type (BFS)
 */
export const findDescendantByType = (nodeId: string, workflow: IWorkflow, type: NodeType): IWorkflowNode | null => {
    const visited = new Set<string>();
    const queue= [nodeId];
    
    while(queue.length > 0){
        const currentId = queue.shift()!;
        if(visited.has(currentId)) continue;
        visited.add(currentId);

        const childEdges = workflow.edges.filter((edge) => edge.source === currentId);
        for(const edge of childEdges){
            const childNode = workflow.nodes.find((node) => node.id === edge.target);
            if(childNode?.type === type) return childNode;
            if(childNode) queue.push(edge.target);
        }
    }

    return null;
};