import { resolveWorkflowOutputReference, resolveWorkflowTemplate } from '@/modules/analysis/application/workflow/WorkflowOutputResolution';
import type { WorkflowExecutionContext, WorkflowNode, WorkflowNodeOutput, WorkflowNodeType, WorkflowValue } from '@/modules/analysis/contracts/workflow.types';

export interface WorkflowNodeHandler<TOutput extends object = object> {
    readonly type: WorkflowNodeType;
    execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<TOutput>;
};

export class WorkflowNodeRegistry {
    private readonly handlers = new Map<WorkflowNodeType, WorkflowNodeHandler<object>>();

    constructor(handlers: WorkflowNodeHandler<object>[] = []) {
        for (const handler of handlers) {
            this.handlers.set(handler.type, handler);
        }
    }

    register(handler: WorkflowNodeHandler<object>): void {
        this.handlers.set(handler.type, handler);
    }

    has(type: WorkflowNodeType): boolean {
        return this.handlers.has(type);
    }

    async execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<WorkflowNodeOutput> {
        const handler = this.handlers.get(node.type);
        if (!handler) {
            throw new Error(`No daemon workflow handler registered for ${node.type}`);
        }

        const output = await handler.execute(node, context) as WorkflowNodeOutput;
        context.outputs.set(node.id, output);
        return output;
    }

    resolveReference(ref: string, context: WorkflowExecutionContext, currentNodeId?: string): WorkflowValue {
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
