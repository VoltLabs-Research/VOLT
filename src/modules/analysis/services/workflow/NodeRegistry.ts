import { WorkflowArgumentsHandler } from '@modules/analysis/services/workflow/nodes/ArgumentsHandler';
import { WorkflowContextHandler } from '@modules/analysis/services/workflow/nodes/ContextHandler';
import { WorkflowEntrypointHandler } from '@modules/analysis/services/workflow/nodes/WorkflowEntrypointHandler';
import { WorkflowExposureHandler } from '@modules/analysis/services/workflow/nodes/ExposureHandler';
import { WorkflowForEachHandler } from '@modules/analysis/services/workflow/nodes/ForEachHandler';
import { WorkflowTrajectoryWindowHandler } from '@modules/analysis/services/workflow/nodes/TrajectoryWindowHandler';
import { WorkflowIfStatementHandler } from '@modules/analysis/services/workflow/nodes/IfStatementHandler';
import { WorkflowModifierHandler } from '@modules/analysis/services/workflow/nodes/ModifierHandler';
import { WorkflowSwitchCaseHandler, WorkflowSwitchStatementHandler } from '@modules/analysis/services/workflow/nodes/SwitchStatementHandler';
import { WorkflowValueResolver } from '@modules/analysis/services/workflow/WorkflowValueResolver';
import { WorkflowNodeType } from '@shared/contracts/types/workflow.types';
import type { WorkflowExecutionContext, WorkflowNode, WorkflowNodeOutput, WorkflowValue } from '@shared/contracts/types/workflow.types';

export type WorkflowNodePhase = 'planning' | 'runtime';

export const WORKFLOW_NODE_PHASE: Record<WorkflowNodeType, WorkflowNodePhase> = {
    [WorkflowNodeType.Modifier]: 'planning',
    [WorkflowNodeType.Arguments]: 'planning',
    [WorkflowNodeType.Context]: 'planning',
    [WorkflowNodeType.ForEach]: 'planning',
    [WorkflowNodeType.TrajectoryWindow]: 'planning',
    [WorkflowNodeType.Entrypoint]: 'runtime',
    [WorkflowNodeType.Plugin]: 'runtime',
    [WorkflowNodeType.Exposure]: 'runtime',
    [WorkflowNodeType.Export]: 'runtime',
    [WorkflowNodeType.IfStatement]: 'runtime',
    [WorkflowNodeType.SwitchStatement]: 'runtime',
    [WorkflowNodeType.SwitchCase]: 'runtime'
};

export const isPlanningNodeType = (type: WorkflowNodeType): boolean => {
    return WORKFLOW_NODE_PHASE[type] === 'planning';
};

export interface WorkflowNodeHandler<TOutput extends object = object> {
    readonly type: WorkflowNodeType;
    readonly phase: WorkflowNodePhase;
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
        workflowNodeRegistry.register(new WorkflowTrajectoryWindowHandler());
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

let workflowNodeRegistryInstance: WorkflowNodeRegistry | null = null;

export const getWorkflowNodeRegistry = (): WorkflowNodeRegistry => {
    workflowNodeRegistryInstance ??= WorkflowNodeRegistry.createDefault();
    return workflowNodeRegistryInstance;
};
