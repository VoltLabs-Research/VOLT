import { WorkflowNodeType } from '@shared/contracts/types/workflow.types';
import type {
    WorkflowArgumentDefinition,
    WorkflowDefinition,
    WorkflowPluginNodeData,
    WorkflowPluginReferenceSelection
} from '@shared/contracts';
import type { WorkflowNodeOutput, WorkflowOutputs } from '@shared/contracts/types/workflow.types';

interface WorkflowPluginReferenceSelectionWithConfig {
    pluginId: WorkflowPluginReferenceSelection['pluginId'];
    config: WorkflowNodeOutput;
}

export interface WorkflowPluginReferenceValueWithSelections {
    selections: WorkflowPluginReferenceSelectionWithConfig[];
}

/** One plugin the node resolved to, with the config and timesteps to run it with. */
export interface ResolvedPluginExecution {
    pluginId: string;
    config: WorkflowNodeOutput;
    selectedTimesteps: number[];
    outputPathMode: 'isolated' | 'parent';
}

export interface WorkflowExposureArtifact {
    exposureId: string;
    name: string;
    results: string;
    filePath: string;
}

export interface PluginExecutionOutput {
    pluginId: string;
    output: WorkflowNodeOutput;
}

const resolveArgumentReferenceExecutions = (
    workflow: WorkflowDefinition,
    pluginNodeData: WorkflowPluginNodeData,
    argumentReference: string,
    outputs: WorkflowOutputs,
    base: Omit<ResolvedPluginExecution, 'pluginId' | 'config'>
): ResolvedPluginExecution[] => {
    const argumentsNode = workflow.nodes.find((node) => node.type === WorkflowNodeType.Arguments);
    const argumentValue = argumentsNode && outputs.get(argumentsNode.id)?.[argumentReference];
    const selections = (argumentValue as WorkflowPluginReferenceValueWithSelections | undefined)?.selections ?? [];
    if (!argumentsNode || selections.length === 0) {
        return [];
    }

    const shouldUseSelectionConfig = argumentsNode.data.arguments?.arguments
        ?.find((definition: WorkflowArgumentDefinition) => definition.argument === argumentReference)
        ?.showPluginConfiguration === true;

    return selections.map((selection) => ({
        ...base,
        pluginId: selection.pluginId,
        config: shouldUseSelectionConfig
            ? selection.config
            : pluginNodeData.configByPluginId?.[selection.pluginId] ?? pluginNodeData.config ?? {}
    }));
};

/**
 * Expands a plugin node into the executions it implies: either the single plugin it
 * names, or one execution per selection of the arguments node it references.
 */
export const resolvePluginExecutionsForNode = (
    workflow: WorkflowDefinition | undefined,
    pluginNodeData: WorkflowPluginNodeData | undefined,
    outputs: WorkflowOutputs
): ResolvedPluginExecution[] => {
    if (!pluginNodeData) {
        return [];
    }

    const base = {
        selectedTimesteps: pluginNodeData.selectedTimesteps ?? [],
        outputPathMode: pluginNodeData.outputPathMode === 'parent' ? 'parent' as const : 'isolated' as const
    };
    const { argumentReference, pluginId } = pluginNodeData;
    const executionMode = pluginNodeData.executionMode
        ?? (!pluginId && argumentReference ? 'argumentReference' : pluginId ? 'manual' : undefined);

    if (executionMode === 'argumentReference') {
        return workflow && argumentReference
            ? resolveArgumentReferenceExecutions(workflow, pluginNodeData, argumentReference, outputs, base)
            : [];
    }

    return pluginId
        ? [{
            ...base,
            pluginId,
            config: pluginNodeData.config ?? {}
        }]
        : [];
};

export const createNestedExecutionResult = (items: WorkflowExposureArtifact[]): WorkflowNodeOutput => ({
    execution_result: {
        exposures: {
            items,
            str_json: JSON.stringify(items)
        }
    }
});

/**
 * Folds every execution of one plugin node into a single node output. The JSON
 * projections are lazy so a workflow that never interpolates them never pays for
 * the serialisation.
 */
export const buildAggregatedPluginOutput = (executions: PluginExecutionOutput[]): WorkflowNodeOutput => {
    const allExposureItems = executions.flatMap((execution) => (
        (execution.output.execution_result as { exposures: { items: WorkflowExposureArtifact[] } })
            .exposures.items
    ));
    let executionsJson: string | undefined;
    let exposuresJson: string | undefined;

    return {
        pluginIds: executions.map((execution) => execution.pluginId),
        executions: {
            items: executions,
            get str_json() {
                return executionsJson ??= JSON.stringify(executions);
            }
        },
        execution_result: {
            exposures: {
                items: allExposureItems,
                get str_json() {
                    return exposuresJson ??= JSON.stringify(allExposureItems);
                }
            }
        }
    };
};
