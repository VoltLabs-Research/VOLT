import type { WorkflowNodeOutput, WorkflowValue } from '@shared/contracts/types/workflow.types';
import type { WorkflowPluginReferenceValueWithSelections } from '@modules/analysis/services/workflow/plugin-node-executions';
import {
    applyPluginReferenceMappings as applyMappingsToConfig,
    isArgumentVisible,
    readWorkflowModifierKey,
    resolveArgumentValue
} from '@volt/contracts/modules/plugin/arguments';
import { ArgumentType } from '@volt/contracts/modules/plugin/enums';
import type {
    IArgumentDefinition,
    IPluginReferenceSelection,
    IWorkflow
} from '@volt/contracts/modules/plugin/workflow';

type PluginReferenceSelections = WorkflowPluginReferenceValueWithSelections['selections'];

interface PluginReferencePlanningItem {
    referencePath: string;
    pluginId: string;
    config: WorkflowNodeOutput;
}

export const readPluginReferenceSelections = (value: WorkflowValue): PluginReferenceSelections => {
    const selections = (value as { selections?: IPluginReferenceSelection[] } | undefined)?.selections;

    return selections?.map((selection) => ({
        pluginId: selection.pluginId,
        config: selection.config ?? {}
    })) ?? [];
};

export const applyPluginReferenceMappings = (
    definitions: IArgumentDefinition[],
    values: WorkflowNodeOutput,
    nestedWorkflows: Map<string, IWorkflow>
): void => {
    for (const definition of definitions) {
        const argumentKey = definition.argument;
        if (!argumentKey || definition.type !== ArgumentType.PLUGIN_REFERENCE) {
            continue;
        }

        values[argumentKey] = {
            selections: readPluginReferenceSelections(values[argumentKey]).map((selection) => ({
                pluginId: selection.pluginId,
                config: applyMappingsToConfig(
                    {
                        pluginId: selection.pluginId,
                        pluginKey: readWorkflowModifierKey(nestedWorkflows.get(selection.pluginId)),
                        config: selection.config
                    },
                    definition,
                    definitions,
                    values
                )
            }))
        } satisfies WorkflowPluginReferenceValueWithSelections;
    }
};

export const collectPluginReferences = (
    definitions: IArgumentDefinition[],
    values: WorkflowNodeOutput,
    pathPrefix = ''
): PluginReferencePlanningItem[] => definitions.flatMap((definition) => {
    const argumentKey = definition.argument;
    if (!argumentKey || !isArgumentVisible(definition, definitions, values)) {
        return [];
    }

    const referencePath = `${pathPrefix}${argumentKey}`;
    const value = resolveArgumentValue(definition, values[argumentKey]);

    if (definition.type === ArgumentType.PLUGIN_REFERENCE) {
        return readPluginReferenceSelections(value).map((selection) => ({
            referencePath,
            ...selection
        }));
    }

    if (definition.type === ArgumentType.LIST && Array.isArray(value)) {
        return value.flatMap((entry, index) => collectPluginReferences(
            definition.listArguments ?? [],
            entry as WorkflowNodeOutput,
            `${referencePath}[${index}].`
        ));
    }

    return [];
});
