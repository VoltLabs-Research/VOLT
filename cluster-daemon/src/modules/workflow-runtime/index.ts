import { analysisRepository } from './repositories';
import { WorkflowEngine, WorkflowNodeRegistry } from './services';
import {
    WorkflowArgumentsHandler,
    WorkflowContextHandler,
    WorkflowForEachHandler,
    WorkflowIfStatementHandler,
    WorkflowModifierHandler
} from './handlers';

export interface WorkflowRuntimeModule {
    workflowNodeRegistry: WorkflowNodeRegistry;
    workflowEngine: WorkflowEngine;
}

export const createWorkflowRuntimeModule = (): WorkflowRuntimeModule => {
    const workflowNodeRegistry = new WorkflowNodeRegistry();
    workflowNodeRegistry.register(new WorkflowModifierHandler(analysisRepository));
    workflowNodeRegistry.register(new WorkflowArgumentsHandler(workflowNodeRegistry));
    workflowNodeRegistry.register(new WorkflowContextHandler());
    workflowNodeRegistry.register(new WorkflowForEachHandler(workflowNodeRegistry));
    workflowNodeRegistry.register(new WorkflowIfStatementHandler(workflowNodeRegistry));

    return {
        workflowNodeRegistry,
        workflowEngine: new WorkflowEngine(workflowNodeRegistry)
    };
};
