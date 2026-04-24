import { WorkflowArgumentsHandler } from '@/modules/analysis/application/workflow/nodes/ArgumentsHandler';
import { WorkflowContextHandler } from '@/modules/analysis/application/workflow/nodes/ContextHandler';
import { WorkflowEntrypointHandler } from '@/modules/analysis/application/workflow/nodes/WorkflowEntrypointHandler';
import { WorkflowExposureHandler } from '@/modules/analysis/application/workflow/nodes/ExposureHandler';
import { WorkflowForEachHandler } from '@/modules/analysis/application/workflow/nodes/ForEachHandler';
import { WorkflowIfStatementHandler } from '@/modules/analysis/application/workflow/nodes/IfStatementHandler';
import { WorkflowModifierHandler } from '@/modules/analysis/application/workflow/nodes/ModifierHandler';
import { WorkflowSwitchCaseHandler, WorkflowSwitchStatementHandler } from '@/modules/analysis/application/workflow/nodes/SwitchStatementHandler';
import { WorkflowValueResolver } from '@/modules/analysis/application/workflow/WorkflowValueResolver';
import type { WorkflowExecutionContext, WorkflowNode, WorkflowNodeOutput, WorkflowNodeType, WorkflowValue } from '@/modules/analysis/contracts/workflow.types';

export interface WorkflowNodeHandler<TOutput extends object = object> {
    readonly type: WorkflowNodeType;
    execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<TOutput>;
};

export class WorkflowNodeRegistry {
    private readonly handlers = new Map<WorkflowNodeType, WorkflowNodeHandler<object>>();

    static createDefault(): WorkflowNodeRegistry {
        const workflowNodeRegistry = new WorkflowNodeRegistry();

        workflowNodeRegistry.register(new WorkflowModifierHandler());
        workflowNodeRegistry.register(new WorkflowArgumentsHandler(workflowNodeRegistry));
        workflowNodeRegistry.register(new WorkflowContextHandler());
        workflowNodeRegistry.register(new WorkflowForEachHandler(workflowNodeRegistry));
        workflowNodeRegistry.register(new WorkflowEntrypointHandler());
        workflowNodeRegistry.register(new WorkflowExposureHandler());
        workflowNodeRegistry.register(new WorkflowIfStatementHandler(workflowNodeRegistry));
        workflowNodeRegistry.register(new WorkflowSwitchStatementHandler(workflowNodeRegistry));
        workflowNodeRegistry.register(new WorkflowSwitchCaseHandler());

        return workflowNodeRegistry;
    }

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

    createValueResolver(
        context: WorkflowExecutionContext,
        currentNodeId?: string
    ): WorkflowValueResolver {
        return new WorkflowValueResolver({
            outputs: context.outputs,
            workflow: context.workflow,
            context,
            currentNodeId
        });
    }

    resolveReference(ref: string, context: WorkflowExecutionContext, currentNodeId?: string): WorkflowValue {
        return this.createValueResolver(context, currentNodeId).resolveReference(ref);
    }

    shouldResolveExpression(value: WorkflowValue): value is string {
        return WorkflowValueResolver.shouldResolveExpression(value);
    }

    resolveExpressionValue(
        expression: string,
        context: WorkflowExecutionContext,
        currentNodeId?: string
    ): Promise<WorkflowValue> {
        return this.createValueResolver(context, currentNodeId).resolveExpressionValue(expression);
    }

    resolveComparableString(
        expression: string,
        context: WorkflowExecutionContext,
        currentNodeId?: string
    ): Promise<string> {
        return this.createValueResolver(context, currentNodeId).resolveComparableString(expression);
    }
};
