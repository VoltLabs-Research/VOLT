import { WorkflowArgumentsHandler, WorkflowContextHandler, WorkflowForEachHandler, WorkflowIfStatementHandler, WorkflowModifierHandler } from '../handlers';
import { WorkflowNodeRegistry } from '../services';
import { createAnalysisLookup } from './createAnalysisLookup';

export const createWorkflowNodeRegistry = (): WorkflowNodeRegistry => {
    const workflowNodeRegistry = new WorkflowNodeRegistry();
    const analysisLookup = createAnalysisLookup();

    workflowNodeRegistry.register(new WorkflowModifierHandler(analysisLookup));
    workflowNodeRegistry.register(new WorkflowArgumentsHandler(workflowNodeRegistry));
    workflowNodeRegistry.register(new WorkflowContextHandler());
    workflowNodeRegistry.register(new WorkflowForEachHandler(workflowNodeRegistry));
    workflowNodeRegistry.register(new WorkflowIfStatementHandler(workflowNodeRegistry));

    return workflowNodeRegistry;
};
