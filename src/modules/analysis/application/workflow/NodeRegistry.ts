import { WorkflowArgumentsHandler } from '@/modules/analysis/application/workflow/nodes/ArgumentsHandler';
import { WorkflowContextHandler } from '@/modules/analysis/application/workflow/nodes/ContextHandler';
import { WorkflowEntrypointHandler } from '@/modules/analysis/application/workflow/nodes/WorkflowEntrypointHandler';
import { WorkflowExposureHandler } from '@/modules/analysis/application/workflow/nodes/ExposureHandler';
import { WorkflowForEachHandler } from '@/modules/analysis/application/workflow/nodes/ForEachHandler';
import { WorkflowIfStatementHandler } from '@/modules/analysis/application/workflow/nodes/IfStatementHandler';
import { WorkflowModifierHandler } from '@/modules/analysis/application/workflow/nodes/ModifierHandler';
import { WorkflowSwitchCaseHandler, WorkflowSwitchStatementHandler } from '@/modules/analysis/application/workflow/nodes/SwitchStatementHandler';
import { WorkflowValueResolver } from '@/modules/analysis/application/workflow/WorkflowValueResolver';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import type { WorkflowExecutionContext, WorkflowNode, WorkflowNodeOutput, WorkflowValue } from '@/modules/analysis/contracts/workflow.types';

export type WorkflowNodePhase = 'planning' | 'runtime';

/**
 * Single source of truth for the planning-vs-runtime classification of every
 * workflow node type.
 *
 * - `planning`: nodes evaluated while computing the itemization/execution plan
 *   (the workflow prefix Modifier -> Arguments -> Context -> ForEach).
 * - `runtime`: nodes evaluated during per-item execution (plugins, entrypoints,
 *   exposures, exports and control-flow nodes).
 *
 * Both `WorkflowNodeRegistry` and the individual node handlers derive their
 * phase from this map, and call sites that only hold a node TYPE (e.g.
 * `WorkflowEngine`/`WorkflowRuntime`) consult it directly, so the classification
 * can never drift between locations.
 */
export const WORKFLOW_NODE_PHASE: Record<WorkflowNodeType, WorkflowNodePhase> = {
    [WorkflowNodeType.Modifier]: 'planning',
    [WorkflowNodeType.Arguments]: 'planning',
    [WorkflowNodeType.Context]: 'planning',
    [WorkflowNodeType.ForEach]: 'planning',
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

    isPlanningNode(type: WorkflowNodeType): boolean {
        return isPlanningNodeType(type);
    }

    getPlanningNodeTypes(): Set<WorkflowNodeType> {
        return new Set(
            (Object.keys(WORKFLOW_NODE_PHASE) as WorkflowNodeType[])
                .filter((type) => WORKFLOW_NODE_PHASE[type] === 'planning')
        );
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
