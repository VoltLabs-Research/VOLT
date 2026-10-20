import type { Plugin } from '@modules/plugin/contracts/plugin';
import {
    WorkflowNodeType,
    type ArgumentDefinition,
    type PluginReferenceArgumentMapping
} from '@modules/plugin/models/plugin/workflow/WorkflowTypes';

interface PluginReferenceMappingTarget {
    pluginId: string;
    config: Record<string, unknown>;
    definition: ArgumentDefinition;
    definitions: ArgumentDefinition[];
    scopeValues: Record<string, unknown>;
}

export const resolveArgumentExecutionValue = (
    definition: ArgumentDefinition,
    value: unknown
): unknown => {
    if (value !== undefined) {
        return value;
    }

    if (definition.value !== undefined) {
        return definition.value;
    }

    return definition.default;
};

export const getPluginModifierKey = (plugin: Plugin): string => {
    const modifierKey = plugin.props.modifier?.key;
    if (modifierKey !== undefined) {
        return modifierKey.trim();
    }

    const modifierNode = plugin.props.workflow.props.nodes.find((node) => node.type === WorkflowNodeType.Modifier);
    return modifierNode?.data.modifier?.key?.trim() ?? '';
};

const normalizePluginReferenceMappings = (
    mappings: PluginReferenceArgumentMapping[] | undefined
): PluginReferenceArgumentMapping[] => {
    return (mappings ?? []).flatMap((mapping) => {
        const sourceArgument = mapping.sourceArgument.trim();
        const targetArgument = mapping.targetArgument.trim();

        if (!sourceArgument || !targetArgument) {
            return [];
        }

        const targetPluginId = mapping.targetPluginId?.trim() ?? '';
        const targetPluginKey = mapping.targetPluginKey?.trim() ?? '';

        return [{
            sourceArgument,
            targetArgument,
            ...(targetPluginId ? { targetPluginId } : {}),
            ...(targetPluginKey ? { targetPluginKey } : {}),
            ...(mapping.valueMap ? { valueMap: mapping.valueMap } : {})
        }];
    });
};

const resolveMappingSourceValue = (
    mapping: PluginReferenceArgumentMapping,
    definitions: ArgumentDefinition[],
    scopeValues: Record<string, unknown>
): unknown => {
    const sourceDefinition = definitions.find((definition) => definition.argument === mapping.sourceArgument);
    const value = sourceDefinition
        ? resolveArgumentExecutionValue(sourceDefinition, scopeValues[mapping.sourceArgument])
        : scopeValues[mapping.sourceArgument];

    if (!mapping.valueMap) {
        return value;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        const valueMapKey = String(value);
        if (Object.prototype.hasOwnProperty.call(mapping.valueMap, valueMapKey)) {
            return mapping.valueMap[valueMapKey];
        }
    }

    return value;
};

export const applyPluginReferenceMappings = (
    target: PluginReferenceMappingTarget,
    referencedPlugin?: Plugin
): Record<string, unknown> => {
    const mappings = normalizePluginReferenceMappings(target.definition.pluginReferenceMappings);
    if (mappings.length === 0) {
        return target.config;
    }

    const pluginKey = referencedPlugin ? getPluginModifierKey(referencedPlugin) : '';
    const config = { ...target.config };

    for (const mapping of mappings) {
        if (mapping.targetPluginId && mapping.targetPluginId !== target.pluginId) {
            continue;
        }

        if (mapping.targetPluginKey && mapping.targetPluginKey !== pluginKey) {
            continue;
        }

        const mappedValue = resolveMappingSourceValue(mapping, target.definitions, target.scopeValues);
        if (mappedValue === undefined) {
            continue;
        }

        config[mapping.targetArgument] = mappedValue;
    }

    return config;
};
