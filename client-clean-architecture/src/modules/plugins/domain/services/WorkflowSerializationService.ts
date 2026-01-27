import type { IWorkflow } from '../entities';

export interface WorkflowNodeInput {
    id: string;
    type: string;
    position: { x: number; y: number };
    data?: Record<string, unknown>;
}

export interface WorkflowEdgeInput {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
}

export class WorkflowSerializationService {
    toWorkflow(nodes: WorkflowNodeInput[], edges: WorkflowEdgeInput[]): IWorkflow {
        return {
            nodes: nodes.map((node) => ({
                id: node.id,
                type: node.type,
                position: node.position,
                data: {
                    modifier: node.data?.modifier,
                    arguments: node.data?.arguments,
                    context: node.data?.context,
                    forEach: node.data?.forEach,
                    entrypoint: node.data?.entrypoint,
                    exposure: node.data?.exposure,
                    schema: node.data?.schema,
                    visualizers: node.data?.visualizers,
                    export: node.data?.export,
                    ifStatement: node.data?.ifStatement
                }
            })),
            edges: edges.map((edge) => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                sourceHandle: edge.sourceHandle ?? undefined,
                targetHandle: edge.targetHandle ?? undefined
            })),
            viewport: { x: 0, y: 0, zoom: 1 }
        };
    }

    fromWorkflow(workflow: IWorkflow): { nodes: WorkflowNodeInput[]; edges: WorkflowEdgeInput[] } {
        return {
            nodes: workflow.nodes.map((node: any) => ({
                id: node.id,
                type: node.type,
                position: node.position,
                data: { ...(node.data ?? {}) }
            })),
            edges: workflow.edges.map((edge: any) => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                sourceHandle: edge.sourceHandle ?? undefined,
                targetHandle: edge.targetHandle ?? undefined
            }))
        };
    }
}
