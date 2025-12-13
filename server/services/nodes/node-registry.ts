import { NodeType } from '@/types/models/plugin';
import { IWorkflowNode, IWorkflowEdge } from '@/types/models/modifier';
import { NodeOutputSchema } from '@/services/nodes/schema-types';
import logger from '@/logger';

export interface ExecutionContext{
    outputs: Map<string, Record<string, any>>;
    userConfig: Record<string, any>;
    trajectoryId: string;
    analysisId: string;
    generatedFiles: string[];
    pluginSlug: string;
    pluginDir: string;
    workflow: {
        nodes: IWorkflowNode[];
        edges: IWorkflowEdge[];
    };
};

export interface NodeHandler<TOutput = Record<string, any>>{
    readonly type: NodeType;
    readonly outputSchema: NodeOutputSchema;
    execute(node: IWorkflowNode, context: ExecutionContext): Promise<TOutput>;
}

class NodeRegistry{
    private handlers = new Map<NodeType, NodeHandler>();

    register(handler: NodeHandler): void{
        if(this.handlers.has(handler.type)){
            logger.warn(`[NodeRegistry] Overwriting handler for type: ${handler.type}`);
        }
        this.handlers.set(handler.type, handler);
    }

    get(type: NodeType): NodeHandler | undefined{
        return this.handlers.get(type);
    }

    async execute(node: IWorkflowNode, context: ExecutionContext): Promise<Record<string, any>>{
        const handler = this.handlers.get(node.type as NodeType);
        if(!handler){
            throw new Error(`[NodeRegistry] No handler registered for type: ${node.type}`);
        }
        logger.debug(`[NodeRegistry] Executing: ${node.id} (${node.type})`);
        const output = await handler.execute(node, context);
        context.outputs.set(node.id, output);
        return output;
    }

    has(type: NodeType): boolean{
        return this.handlers.has(type);
    }

    getRegisteredTypes(): NodeType[]{
        return Array.from(this.handlers.keys());
    }

    getSchemas(): Record<string, NodeOutputSchema>{
        const schemas: Record<string, NodeOutputSchema> = {};
        for(const [type, handler] of this.handlers){
            schemas[type] = handler.outputSchema;
        }
        return schemas;
    }
};

const nodeRegistry = new NodeRegistry();

export const resolveReference = (ref: string, context: ExecutionContext): any => {
    const parts = ref.split('.');
    const nodeId = parts[0];
    const propertyPath = parts.slice(1).join('.');
    const nodeOutput = context.outputs.get(nodeId);
    if(!nodeOutput){
        logger.error(`[NodeRegistry] Reference resolution failed: Node '${nodeId}' not found`);
        return undefined;
    }

    if(!propertyPath) return nodeOutput;
    return propertyPath.split('.').reduce((acc, key) => acc?.[key], nodeOutput);
};

export const resolveTemplate = (template: string, context: ExecutionContext): string => {
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, ref) => {
        const value = resolveReference(ref.trim(), context);
        return value !== undefined ? String(value) : '';
    });
};

export default nodeRegistry;
