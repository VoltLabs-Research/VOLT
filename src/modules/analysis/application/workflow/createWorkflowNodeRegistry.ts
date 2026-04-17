import { WorkflowArgumentsHandler } from '@/modules/analysis/application/workflow/nodes/ArgumentsHandler';
import { WorkflowContextHandler } from '@/modules/analysis/application/workflow/nodes/ContextHandler';
import { WorkflowForEachHandler } from '@/modules/analysis/application/workflow/nodes/ForEachHandler';
import { WorkflowIfStatementHandler } from '@/modules/analysis/application/workflow/nodes/IfStatementHandler';
import { WorkflowModifierHandler } from '@/modules/analysis/application/workflow/nodes/ModifierHandler';
import {
    WorkflowSwitchCaseHandler,
    WorkflowSwitchStatementHandler
} from '@/modules/analysis/application/workflow/nodes/SwitchStatementHandler';
import { WorkflowNodeRegistry } from '@/modules/analysis/application/workflow';

export const createWorkflowNodeRegistry = (): WorkflowNodeRegistry => {
    const workflowNodeRegistry = new WorkflowNodeRegistry();

    workflowNodeRegistry.register(new WorkflowModifierHandler());
    workflowNodeRegistry.register(new WorkflowArgumentsHandler(workflowNodeRegistry));
    workflowNodeRegistry.register(new WorkflowContextHandler());
    workflowNodeRegistry.register(new WorkflowForEachHandler(workflowNodeRegistry));
    workflowNodeRegistry.register(new WorkflowIfStatementHandler(workflowNodeRegistry));
    workflowNodeRegistry.register(new WorkflowSwitchStatementHandler(workflowNodeRegistry));
    workflowNodeRegistry.register(new WorkflowSwitchCaseHandler());

    return workflowNodeRegistry;
};
