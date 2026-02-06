import { EntrypointNodeData } from './nodes/EntrypointNode';
import { WorkflowEdge } from './WorkflowEdge';
import { WorkflowNode, WorkflowNodeType } from './WorkflowNode';

export interface WorkflowViewport{
    x: number;
    y: number;
    zoom: number;
};

export interface WorkflowProps{
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    viewport?: WorkflowViewport;
};

export default class Workflow{
    constructor(
        public id: string,
        public props: WorkflowProps
    ){}

    updateEntrypoint(update: Partial<EntrypointNodeData>){
        const entrypointNode = this.props.nodes.find((node) => node.type === WorkflowNodeType.Entrypoint);
        if(!entrypointNode || !entrypointNode.data?.entrypoint){
            return;
        }
    
        entrypointNode.data.entrypoint = {
            ...entrypointNode.data.entrypoint,
            ...update
        };
    }

    /**
     * Node lookup map.
     */
    getNodeMap(): Map<string, any>{
        const map = new Map();
        for(const node of this.props.nodes){
            map.set(node.id, node);
        }
        return map;
    }

    /**
     * Edge lookup for finding connected exposures.
     */
    getParentMap(): Map<string, string[]>{
        const map = new Map<string, string[]>();
        for(const edge of this.props.edges){
            const parents = map.get(edge.target) || [];
            parents.push(edge.source);
            map.set(edge.target, parents);
        }
        return map;
    }

    /**
     * Traverse the graph from a specific handle (branch) to find all downstream nodes.
     */
    findDescendantNodesOnBranch(startNodeId: string, sourceHandle: string): string[]{
        const result: string[] = [];
        const visited = new Set<string>();

        // Find immediate children connected to the specific handle (e.g., "False" handle)
        const initialChildren = this.props.edges
            .filter((edge) => edge.source === startNodeId && edge.sourceHandle === sourceHandle)
            .map((edge) => edge.target);

        const queue = [...initialChildren];

        // BFS to find all descendants of those children
        while(queue.length > 0){
            const nodeId = queue.shift()!;
            if(visited.has(nodeId)) continue;

            visited.add(nodeId);
            result.push(nodeId);

            const downstreamChildren = this.props.edges
                .filter((edge) => edge.source === nodeId)
                .map((edge) => edge.target);

            queue.push(...downstreamChildren);
        }

        return result;
    }

    /**
     * Traverses the workflow graph downwards from the exposure node
     * looking for a node of type visualizer. If found, it extracts the column
     * definitions configured within it.
     */
    findColumnsDefinitionsFromExposureVisualizer(listingSlug: string){
        // TODO: Refactor 
        const exposureNodeId = this.findExposureByListingSlug(listingSlug);
        if(!exposureNodeId) return [];

        const visited = new Set<string>();
        const queue = [exposureNodeId];

        while(queue.length){
            const id = queue.shift()!;
            if(visited.has(id)) continue;
            visited.add(id);

            const outEdges = this.props.edges.filter((edge) => edge.source === id);
            for(const edge of outEdges){
                const target = this.props.nodes.find((node) => node.id === edge.target);
                if(!target) continue;

                if(target.type === WorkflowNodeType.Visualizers && target.data.visualizers?.listing){
                    const listingDefinition = target.data.visualizers.listing || {};
                    return Object
                        .entries(listingDefinition)
                        .map(([ path, label ]) => ({ path, label }));
                }

                queue.push(edge.target);
            }
        }

        return [];
    }

    /**
     * Locates the ID of the exposure node corresponding to the requested listing slug.
     */
    findExposureByListingSlug(listingSlug: string): string | null{
        const node = this.props.nodes.find((node) => node.type === WorkflowNodeType.Exposure && node?.data?.exposure?.name === listingSlug);
        return node?.id ?? null;
    }

    /**
     * Find immediate parent node of specified type.
     */
    findParentByType(nodeId: string, type: WorkflowNodeType): WorkflowNode | null{
        const parentEdge = this.props.edges.find((edge) => edge.target === nodeId);
        if(!parentEdge) return null;

        const parentNode = this.props.nodes.find((node) => node.id === parentEdge.source);
        if(parentNode?.type === type) return parentNode;

        return this.findParentByType(parentEdge.source, type);
    }

    /**
     * Find any ancestor node of specified type (BFS).
     */
    findAncestorByType(nodeId: string, type: WorkflowNodeType): WorkflowNode | null{
        const visited = new Set<string>();
        const queue = [nodeId];

        while(queue.length > 0){
            const currentId = queue.shift()!;
            if(visited.has(currentId)) continue;
            visited.add(currentId);

            const parentEdges = this.props.edges.filter((edge) => edge.target === currentId);
            for(const edge of parentEdges){
                const parentNode = this.props.nodes.find((node) => node.id === edge.source);
                if(parentNode?.type === type) return parentNode;
                queue.push(edge.source);
            }
        }

        return null;
    }

    /**
     * Find descendant node of specified type (BFS)
     */
    findDescendantByType(nodeId: string, type: WorkflowNodeType): WorkflowNode | null{
        const visited = new Set<string>();
        const queue = [nodeId];

        while(queue.length > 0){
            const currentId = queue.shift()!;
            if(visited.has(currentId)) continue;
            visited.add(currentId);

            const childEdges = this.props.edges.filter((edge) => edge.source === currentId);
            for(const edge of childEdges){
                const childNode = this.props.nodes.find((node) => node.id === edge.target);
                if(childNode?.type === type) return childNode;
                if(childNode) queue.push(edge.target);
            }
        }

        return null;
    }

    topologicalSort(): WorkflowNode[]{
        const nodeMap = new Map(this.props.nodes.map((node) => [node.id, node]));
        const inDegree = new Map<string, number>();
        const adjacency = new Map<string, string[]>();

        for(const node of this.props.nodes){
            inDegree.set(node.id, 0);
            adjacency.set(node.id, []);
        }

        for(const edge of this.props.edges){
            const adj = adjacency.get(edge.source) || [];
            adj.push(edge.target);
            adjacency.set(edge.source, adj);
            inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
        }

        const queue: string[] = [];
        for(const [id, degree] of inDegree){
            if(degree === 0) queue.push(id);
        }

        const result: WorkflowNode[] = [];
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
    }
};