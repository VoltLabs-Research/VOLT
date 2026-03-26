import { MIN_CLUSTER_CPU, MIN_CLUSTER_MEMORY_MB, clampClusterResourceValue } from '@/modules/container/utilities/resource-allocation';
import type { ClusterResourceLimits } from '@/modules/container/api/entities/cluster-resource-limits';
import type { ScriptingNotebookContainerResources } from '@/modules/scripting/api/entities/scripting-notebook';

export const DEFAULT_SCRIPTING_NOTEBOOK_CPUS = 2;
export const DEFAULT_SCRIPTING_NOTEBOOK_MEMORY_MB = 2048;

export const getDefaultScriptingNotebookContainerResources = (): ScriptingNotebookContainerResources => ({
    cpus: DEFAULT_SCRIPTING_NOTEBOOK_CPUS,
    memoryMB: DEFAULT_SCRIPTING_NOTEBOOK_MEMORY_MB
});

export const clampScriptingNotebookContainerResources = (
    resources: ScriptingNotebookContainerResources,
    resourceLimits: ClusterResourceLimits | null
): ScriptingNotebookContainerResources => {
    return {
        cpus: clampClusterResourceValue(resources.cpus, MIN_CLUSTER_CPU, resourceLimits?.maxCpus),
        memoryMB: clampClusterResourceValue(resources.memoryMB, MIN_CLUSTER_MEMORY_MB, resourceLimits?.maxMemoryMB)
    };
};
