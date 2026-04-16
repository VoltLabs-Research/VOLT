import { resolveWorkflowOutputReference, resolveWorkflowTemplate } from './WorkflowOutputResolution';
import type { WorkflowExecutionContext, WorkflowNode, WorkflowNodeType } from '../contracts';

interface NodeOutputSchema {
    properties: Record<string, unknown>;
};

export interface WorkflowNodeHandler<TOutput = Record<string, unknown>> {
    readonly type: WorkflowNodeType;
    readonly outputSchema: NodeOutputSchema;
    execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<TOutput>;
};

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

    resolveReference(ref: string, context: WorkflowExecutionContext, currentNodeId?: string): unknown {
        return resolveWorkflowOutputReference(ref, context.outputs, {
            workflow: context.workflow,
            currentNodeId
        });
    }

    resolveTemplate(template: string, context: WorkflowExecutionContext, currentNodeId?: string): string {
        return resolveWorkflowTemplate(template, context.outputs, {
            workflow: context.workflow,
            currentNodeId
        });
    }
};
