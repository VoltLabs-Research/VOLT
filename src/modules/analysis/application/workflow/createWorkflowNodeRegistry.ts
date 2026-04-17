import {
    WorkflowArgumentsHandler,
    WorkflowContextHandler,
    WorkflowForEachHandler,
    WorkflowIfStatementHandler,
    WorkflowModifierHandler,
    WorkflowSwitchCaseHandler,
    WorkflowSwitchStatementHandler
} from '@/modules/analysis/application/workflow/nodes';
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
