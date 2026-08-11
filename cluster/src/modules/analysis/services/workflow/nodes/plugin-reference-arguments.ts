import type {
    WorkflowArgumentDefinition,
    WorkflowDefinition,
    WorkflowPluginReferenceArgumentMapping,
    WorkflowPluginReferenceSelection
} from '@shared/contracts';
import type { WorkflowNodeOutput, WorkflowValue } from '@shared/contracts/types/workflow.types';
import { WorkflowNodeType } from '@shared/contracts/types/workflow.types';
import type { WorkflowPluginReferenceValueWithSelections } from '@modules/analysis/services/workflow/plugin-node-executions';
import { isArgumentVisible } from '@modules/analysis/services/workflow/nodes/argument-visibility';

type PluginReferenceSelections = WorkflowPluginReferenceValueWithSelections['selections'];

interface PluginReferencePlanningItem {
    referencePath: string;
    pluginId: string;
    config: WorkflowNodeOutput;
}

export const readPluginReferenceSelections = (value: WorkflowValue): PluginReferenceSelections => {
    const selections = (value as { selections?: WorkflowPluginReferenceSelection[] } | undefined)?.selections;

    return selections?.map((selection) => ({
        pluginId: selection.pluginId,
        config: selection.config ?? {}
    })) ?? [];
};

/**
 * Resolved runtime value first, then the definition's pinned value, then its default.
 * `isArgumentVisible` intentionally uses the opposite precedence.
 */
const readEffectiveArgumentValue = (
    definition: WorkflowArgumentDefinition | undefined,
    value: WorkflowValue
): WorkflowValue => {
    if (value !== undefined) {
        return value;
    }

    if (definition?.value !== undefined) {
        return definition.value;
    }

    return definition?.default;
};

/** Mappings come from a plugin manifest, so either endpoint may legitimately be absent. */
const normalizePluginReferenceMappings = (
    mappings: WorkflowPluginReferenceArgumentMapping[] | undefined
): WorkflowPluginReferenceArgumentMapping[] => (mappings ?? []).flatMap((mapping) => {
    const sourceArgument = mapping.sourceArgument?.trim();
    const targetArgument = mapping.targetArgument?.trim();
    if (!sourceArgument || !targetArgument) {
        return [];
    }

    return [{
        ...mapping,
        sourceArgument,
        targetArgument,
        targetPluginId: mapping.targetPluginId?.trim(),
        targetPluginKey: mapping.targetPluginKey?.trim()
    }];
});

const resolveMappingSourceValue = (
    mapping: WorkflowPluginReferenceArgumentMapping,
    definitions: WorkflowArgumentDefinition[],
    values: WorkflowNodeOutput
): WorkflowValue => {
    const sourceKey = mapping.sourceArgument ?? '';
    const definition = definitions.find((candidate) => candidate.argument === sourceKey);
    const value = readEffectiveArgumentValue(definition, values[sourceKey]);
    const valueMap = mapping.valueMap;

    if (valueMap && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) {
        const valueMapKey = String(value);
        if (Object.hasOwn(valueMap, valueMapKey)) {
            return valueMap[valueMapKey];
        }
    }

    return value;
};

const readWorkflowModifierKey = (workflow: WorkflowDefinition | undefined): string => {
    const modifierKey = workflow?.nodes
        .find((node) => node.type === WorkflowNodeType.Modifier)
        ?.data.modifier?.key;

    return typeof modifierKey === 'string' ? modifierKey.trim() : '';
};

const applyMappingsToSelectionConfig = (
    selection: PluginReferenceSelections[number],
    mappings: WorkflowPluginReferenceArgumentMapping[],
    definitions: WorkflowArgumentDefinition[],
    values: WorkflowNodeOutput,
    nestedWorkflows: Map<string, WorkflowDefinition>
): WorkflowNodeOutput => {
    const pluginKey = readWorkflowModifierKey(nestedWorkflows.get(selection.pluginId));
    const config = { ...selection.config };

    for (const mapping of mappings) {
        if (mapping.targetPluginId && mapping.targetPluginId !== selection.pluginId) {
            continue;
        }

        if (mapping.targetPluginKey && mapping.targetPluginKey !== pluginKey) {
            continue;
        }

        const mappedValue = resolveMappingSourceValue(mapping, definitions, values);
        if (mappedValue !== undefined) {
            config[mapping.targetArgument as string] = mappedValue;
        }
    }

    return config;
};

/**
 * Rewrites every `pluginReference` entry of `values` in place into its normalized
 * `{ selections }` shape, with each selection's config enriched by the definition's
 * argument mappings.
 */
export const applyPluginReferenceMappings = (
    definitions: WorkflowArgumentDefinition[],
    values: WorkflowNodeOutput,
    nestedWorkflows: Map<string, WorkflowDefinition>
): void => {
    for (const definition of definitions) {
        const argumentKey = definition.argument;
        if (!argumentKey || definition.type !== 'pluginReference') {
            continue;
        }

        const selections = readPluginReferenceSelections(values[argumentKey]);
        const mappings = normalizePluginReferenceMappings(definition.pluginReferenceMappings);

        values[argumentKey] = {
            selections: mappings.length === 0
                ? selections
                : selections.map((selection) => ({
                    pluginId: selection.pluginId,
                    config: applyMappingsToSelectionConfig(selection, mappings, definitions, values, nestedWorkflows)
                }))
        } satisfies WorkflowPluginReferenceValueWithSelections;
    }
};

/**
 * Flattens every visible `pluginReference` argument — including those nested inside
 * `list` arguments — into the plugin executions the planner has to schedule.
 */
export const collectPluginReferences = (
    definitions: WorkflowArgumentDefinition[],
    values: WorkflowNodeOutput,
    pathPrefix = ''
): PluginReferencePlanningItem[] => definitions.flatMap((definition) => {
    const argumentKey = definition.argument;
    if (!argumentKey || !isArgumentVisible(definition, definitions, values)) {
        return [];
    }

    const referencePath = `${pathPrefix}${argumentKey}`;
    const value = readEffectiveArgumentValue(definition, values[argumentKey]);

    if (definition.type === 'pluginReference') {
        return readPluginReferenceSelections(value).map((selection) => ({
            referencePath,
            ...selection
        }));
    }

    if (definition.type === 'list' && Array.isArray(value)) {
        return value.flatMap((entry, index) => collectPluginReferences(
            definition.listArguments ?? [],
            entry as WorkflowNodeOutput,
            `${referencePath}[${index}].`
        ));
    }

    return [];
});
