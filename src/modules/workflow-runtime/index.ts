import { createWorkflowNodeRegistry } from './factories';
import { WorkflowEngine, type WorkflowNodeRegistry } from './services';

export interface WorkflowRuntimeModule {
    workflowNodeRegistry: WorkflowNodeRegistry;
    workflowEngine: WorkflowEngine;
}

export const createWorkflowRuntimeModule = (): WorkflowRuntimeModule => {
    const workflowNodeRegistry = createWorkflowNodeRegistry();

    return {
        workflowNodeRegistry,
        workflowEngine: new WorkflowEngine(workflowNodeRegistry)
    };
};
