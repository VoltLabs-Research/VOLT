import { WorkflowArgumentsHandler, WorkflowContextHandler, WorkflowForEachHandler, WorkflowIfStatementHandler, WorkflowModifierHandler } from '../handlers';
import { WorkflowNodeRegistry } from '../services';

export const createWorkflowNodeRegistry = (): WorkflowNodeRegistry => {
    const workflowNodeRegistry = new WorkflowNodeRegistry();

    workflowNodeRegistry.register(new WorkflowModifierHandler());
    workflowNodeRegistry.register(new WorkflowArgumentsHandler(workflowNodeRegistry));
    workflowNodeRegistry.register(new WorkflowContextHandler());
    workflowNodeRegistry.register(new WorkflowForEachHandler(workflowNodeRegistry));
    workflowNodeRegistry.register(new WorkflowIfStatementHandler(workflowNodeRegistry));

    return workflowNodeRegistry;
};
