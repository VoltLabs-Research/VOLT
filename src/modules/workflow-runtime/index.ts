import { createWorkflowNodeRegistry } from './factories';
import { DebugSessionManager, WorkflowEngine, type WorkflowNodeRegistry } from './services';
import type { BinaryExecutorService } from '@/modules/job-runtime/services/BinaryExecutorService';
import type { PluginBinaryCacheService } from '@/modules/job-runtime/services/PluginBinaryCacheService';
import type { ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';

export interface WorkflowRuntimeModule {
    workflowNodeRegistry: WorkflowNodeRegistry;
    workflowEngine: WorkflowEngine;
    debugSessionManager: DebugSessionManager;
}

export const createWorkflowRuntimeModule = (deps: {
    objectStore: ClusterObjectStore;
    pluginBinaryCacheService: PluginBinaryCacheService;
    binaryExecutorService: BinaryExecutorService;
}): WorkflowRuntimeModule => {
    const workflowNodeRegistry = createWorkflowNodeRegistry();

    return {
        workflowNodeRegistry,
        workflowEngine: new WorkflowEngine(workflowNodeRegistry),
        debugSessionManager: new DebugSessionManager(workflowNodeRegistry, deps)
    };
};
