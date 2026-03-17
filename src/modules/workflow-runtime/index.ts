import { createWorkflowNodeRegistry } from './factories';
import { DebugSessionManager, WorkflowEngine, type WorkflowNodeRegistry } from './services';

export interface WorkflowRuntimeModule {
    workflowNodeRegistry: WorkflowNodeRegistry;
    workflowEngine: WorkflowEngine;
    debugSessionManager: DebugSessionManager;
}

export const createWorkflowRuntimeModule = (): WorkflowRuntimeModule => {
    const workflowNodeRegistry = createWorkflowNodeRegistry();

    return {
        workflowNodeRegistry,
        workflowEngine: new WorkflowEngine(workflowNodeRegistry),
        debugSessionManager: new DebugSessionManager(workflowNodeRegistry)
    };
};
