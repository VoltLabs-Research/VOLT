import { singleton } from 'tsyringe';
import { INodeRegistry, INodeHandler, ExecutionContext, NodeOutputSchema } from '../../../domain/ports/INodeRegistry';
import { WorkflowNodeType, WorkflowNode } from '../../../domain/entities/workflow/WorkflowNode';
import logger from '@/src/shared/infrastructure/logger';

@singleton()
export default class NodeRegistry implements INodeRegistry{
    private handlers = new Map<WorkflowNodeType, INodeHandler>();

    register(handler: INodeHandler): void{
        if(this.handlers.has(handler.type)){
            logger.warn(`@node-registry: overwriting handler for type "${handler.type}"`);
        }
        this.handlers.set(handler.type, handler);
    }

    get(type: WorkflowNodeType): INodeHandler | undefined{
        return this.handlers.get(type);
    }

    async execute(node: WorkflowNode, context: ExecutionContext): Promise<Record<string, any>>{
        const handler = this.handlers.get(node.type);
        if(!handler){
            throw new Error(`@node-registry: no handler registered for type "${node.type}"`);
        }
        logger.debug(`@node-registry: executing ${node.id} (${node.type})`);
        const output = await handler.execute(node, context);
        context.outputs.set(node.id, output);
        return output;
    }

    has(type: WorkflowNodeType): boolean{
        return this.handlers.has(type);
    }

    getRegisteredTypes(): WorkflowNodeType[]{
        return Array.from(this.handlers.keys());
    }

    getSchemas(): Record<string, NodeOutputSchema>{
        const schemas: Record<string, NodeOutputSchema> = {};
        for(const [type, handler] of this.handlers){
            schemas[type] = handler.outputSchema;
        }
        return schemas;
    }

    resolveReference(ref: string, context: ExecutionContext): any{
        const parts = ref.split('.');
        const nodeId = parts[0];
        const propertyPath = parts.slice(1).join('.');
        const nodeOutput = context.outputs.get(nodeId);

        if(!nodeOutput){
            logger.warn(`@node-registry: Reference resolution failed: Node "${nodeId}" not found in outputs`);
            return undefined;
        }

        if(!propertyPath) return nodeOutput;
        return propertyPath
            .split('.')
            .reduce((acc, key) => acc?.[key], nodeOutput);
    }

    resolveTemplate(template: string, context: ExecutionContext): string{
        return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, ref) => {
            const value = this.resolveReference(ref.trim(), context);
            return value !== undefined ? String(value) : '';
        });
    }
};