import { singleton } from '@shared/utilities/singleton';
import { WorkflowArgumentsHandler } from '@modules/analysis/services/workflow/nodes/ArgumentsHandler';
import { WorkflowContextHandler } from '@modules/analysis/services/workflow/nodes/ContextHandler';
import { WorkflowEntrypointHandler } from '@modules/analysis/services/workflow/nodes/WorkflowEntrypointHandler';
import { WorkflowExposureHandler } from '@modules/analysis/services/workflow/nodes/ExposureHandler';
import { WorkflowForEachHandler } from '@modules/analysis/services/workflow/nodes/ForEachHandler';
import { WorkflowIfStatementHandler } from '@modules/analysis/services/workflow/nodes/IfStatementHandler';
import { WorkflowModifierHandler } from '@modules/analysis/services/workflow/nodes/ModifierHandler';
import { WorkflowSwitchCaseHandler, WorkflowSwitchStatementHandler } from '@modules/analysis/services/workflow/nodes/SwitchStatementHandler';
import { WorkflowValueResolver } from '@modules/analysis/services/workflow/WorkflowValueResolver';
import type { WorkflowExecutionContext, WorkflowNodeOutput } from '@shared/contracts/types/workflow.types';
import { NodeType } from '@volt/contracts/modules/plugin/enums';
import type { IWorkflowNode } from '@volt/contracts/modules/plugin/workflow';

type WorkflowNodePhase = 'planning' | 'runtime';

const WORKFLOW_NODE_PHASE: Record<NodeType, WorkflowNodePhase> = {
    [NodeType.MODIFIER]: 'planning',
    [NodeType.ARGUMENTS]: 'planning',
    [NodeType.CONTEXT]: 'planning',
    [NodeType.FOREACH]: 'planning',
    [NodeType.ENTRYPOINT]: 'runtime',
    [NodeType.PLUGIN]: 'runtime',
    [NodeType.EXPOSURE]: 'runtime',
    [NodeType.EXPORT]: 'runtime',
    [NodeType.IF_STATEMENT]: 'runtime',
    [NodeType.SWITCH_STATEMENT]: 'runtime',
    [NodeType.SWITCH_CASE]: 'runtime'
};

export const isPlanningNodeType = (type: NodeType): boolean => {
    return WORKFLOW_NODE_PHASE[type] === 'planning';
};

export interface WorkflowNodeHandler<TOutput extends object = object> {
    readonly type: NodeType;
    execute(node: IWorkflowNode, context: WorkflowExecutionContext): Promise<TOutput>;
};

export class WorkflowNodeRegistry {
    private readonly handlers = new Map<NodeType, WorkflowNodeHandler<object>>();

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

    register(handler: WorkflowNodeHandler<object>): void {
        this.handlers.set(handler.type, handler);
    }

    has(type: NodeType): boolean {
        return this.handlers.has(type);
    }

    async execute(node: IWorkflowNode, context: WorkflowExecutionContext): Promise<WorkflowNodeOutput> {
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
};

export const getWorkflowNodeRegistry = singleton((): WorkflowNodeRegistry => WorkflowNodeRegistry.createDefault());
