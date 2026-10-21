import type { WorkflowNodeOutput, WorkflowOutputs } from '@shared/contracts/types/workflow.types';
import { NodeType, PluginNodeOutputPathMode, PluginNodeExecutionMode } from '@volt/contracts/modules/plugin/enums';
import type {
    IArgumentDefinition,
    IPluginNodeData,
    IPluginReferenceSelection,
    IWorkflow
} from '@volt/contracts/modules/plugin/workflow';

interface WorkflowPluginReferenceSelectionWithConfig {
    pluginId: IPluginReferenceSelection['pluginId'];
    config: WorkflowNodeOutput;
}

export interface WorkflowPluginReferenceValueWithSelections {
    selections: WorkflowPluginReferenceSelectionWithConfig[];
}

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
    workflow: IWorkflow,
    pluginNodeData: IPluginNodeData,
    argumentReference: string,
    outputs: WorkflowOutputs,
    base: Omit<ResolvedPluginExecution, 'pluginId' | 'config'>
): ResolvedPluginExecution[] => {
    const argumentsNode = workflow.nodes.find((node) => node.type === NodeType.ARGUMENTS);
    const argumentValue = argumentsNode && outputs.get(argumentsNode.id)?.[argumentReference];
    const selections = (argumentValue as WorkflowPluginReferenceValueWithSelections | undefined)?.selections ?? [];
    if (!argumentsNode || selections.length === 0) {
        return [];
    }

    const shouldUseSelectionConfig = argumentsNode.data.arguments?.arguments
        ?.find((definition: IArgumentDefinition) => definition.argument === argumentReference)
        ?.showPluginConfiguration === true;

    return selections.map((selection) => ({
        ...base,
        pluginId: selection.pluginId,
        config: shouldUseSelectionConfig
            ? selection.config
            : pluginNodeData.configByPluginId?.[selection.pluginId] ?? pluginNodeData.config ?? {}
    }));
};

export const resolvePluginExecutionsForNode = (
    workflow: IWorkflow | undefined,
    pluginNodeData: IPluginNodeData | undefined,
    outputs: WorkflowOutputs
): ResolvedPluginExecution[] => {
    if (!pluginNodeData) {
        return [];
    }

    const base = {
        selectedTimesteps: pluginNodeData.selectedTimesteps ?? [],
        outputPathMode: pluginNodeData.outputPathMode === PluginNodeOutputPathMode.PARENT ? PluginNodeOutputPathMode.PARENT : PluginNodeOutputPathMode.ISOLATED
    };
    const { argumentReference, pluginId } = pluginNodeData;
    const executionMode = pluginNodeData.executionMode
        ?? (!pluginId && argumentReference ? 'argumentReference' : pluginId ? 'manual' : undefined);

    if (executionMode === PluginNodeExecutionMode.ARGUMENT_REFERENCE) {
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
