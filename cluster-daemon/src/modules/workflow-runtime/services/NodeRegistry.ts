import { logger } from '@/core/logger';
import type { WorkflowExecutionContext, WorkflowNode, WorkflowNodeType } from '../contracts';

export interface NodeOutputSchema {
    properties: Record<string, unknown>;
}

export interface WorkflowNodeHandler<TOutput = Record<string, unknown>> {
    readonly type: WorkflowNodeType;
    readonly outputSchema: NodeOutputSchema;
    execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<TOutput>;
}

export class WorkflowNodeRegistry {
    private readonly handlers = new Map<WorkflowNodeType, WorkflowNodeHandler>();

    register(handler: WorkflowNodeHandler): void {
        this.handlers.set(handler.type, handler);
    }

    has(type: WorkflowNodeType): boolean {
        return this.handlers.has(type);
    }

    async execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<Record<string, unknown>> {
        const handler = this.handlers.get(node.type);
        if (!handler) {
            throw new Error(`No daemon workflow handler registered for ${node.type}`);
        }

        const output = await handler.execute(node, context);
        context.outputs.set(node.id, output);
        return output;
    }

    resolveReference(ref: string, context: WorkflowExecutionContext): unknown {
        const parts = ref.split('.');
        const nodeId = parts[0];
        const propertyPath = parts.slice(1);
        const nodeOutput = context.outputs.get(nodeId);
        if (!nodeOutput) {
            logger.warn(`Daemon workflow reference not found for node ${nodeId}`);
            return undefined;
        }

        if (propertyPath.length === 0) {
            return nodeOutput;
        }

        return propertyPath.reduce<unknown>((current, key) => {
            if (typeof current !== 'object' || current === null) {
                return undefined;
            }

            return (current as Record<string, unknown>)[key];
        }, nodeOutput);
    }

    resolveTemplate(template: string, context: WorkflowExecutionContext): string {
        return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, ref) => {
            const value = this.resolveReference(String(ref).trim(), context);
            return value !== undefined ? String(value) : '';
        });
    }
}
