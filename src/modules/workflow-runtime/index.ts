import { createWorkflowNodeRegistry } from './factories';
import { DebugSessionManager, WorkflowEngine } from './services';
import type { BinaryExecutorService } from '@/modules/job-runtime/services/BinaryExecutorService';
import type { PluginBinaryCacheService } from '@/modules/job-runtime/services/PluginBinaryCacheService';
import type { NativeModuleLoader } from '@/modules/trajectory-native/services';
import type { ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';
import type { WorkflowNodeRegistry } from './services';

interface WorkflowRuntimeModule {
    workflowNodeRegistry: WorkflowNodeRegistry;
    workflowEngine: WorkflowEngine;
    debugSessionManager: DebugSessionManager;
}

export const createWorkflowRuntimeModule = (deps: {
    objectStore: ClusterObjectStore;
    pluginBinaryCacheService: PluginBinaryCacheService;
    binaryExecutorService: BinaryExecutorService;
    nativeModuleLoader: NativeModuleLoader;
}): WorkflowRuntimeModule => {
    const workflowNodeRegistry = createWorkflowNodeRegistry();

    return {
        workflowNodeRegistry,
        workflowEngine: new WorkflowEngine(workflowNodeRegistry),
        debugSessionManager: new DebugSessionManager(workflowNodeRegistry, deps)
    };
};
