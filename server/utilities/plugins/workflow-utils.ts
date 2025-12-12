import { NodeType } from '@/models/plugin';
import { IWorkflow, IWorkflowNode } from '@/types/models/modifier';

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

export const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

// TODO: String Scanner class here maybe?
export const parseArgumentString = (str: string): string[] => {
    const args: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for(const char of str){
        if((char === '"' || char === "'") && !inQuote){
            inQuote = true;
            quoteChar = char;
        }else if(char === quoteChar && inQuote){
            inQuote = false;
            quoteChar = '';
        }else if(char === ' ' && !inQuote){
            if(current){
                args.push(current);
                current = '';
            }
        }else{
            current += char;
        }
    }

    if(current) args.push(current);
    return args.filter(Boolean);
};

const topologicalSort = (workflow: IWorkflow): IWorkflowNode[] => {
    const nodeMap = new Map(workflow.nodes.map((node) => [node.id, node]));
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for(const node of workflow.nodes){
        inDegree.set(node.id, 0);
        adjacency.set(node.id, []);
    }

    for(const edge of workflow.edges){
        const adj = adjacency.get(edge.source) || [];
        adj.push(edge.target);
        adjacency.set(edge.source, adj);
        inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }

    const queue: string[] = [];
    for(const [id, degree] of inDegree){
        if(degree === 0) queue.push(id);
    }

    const result: IWorkflowNode[] = [];
    while(queue.length > 0){
        const nodeId = queue.shift()!;
        const node = nodeMap.get(nodeId);
        if(node) result.push(node);

        for(const neighbor of adjacency.get(nodeId) || []){
            const newDegree = (inDegree.get(neighbor) || 0) - 1;
            inDegree.set(neighbor, newDegree);
            if(newDegree === 0) queue.push(neighbor);
        }
    }

    return result;
};