import { ArgumentType, ArgumentVisibilityOperator, NodeType } from './enums';
import type {
    IArgumentDefinition,
    IArgumentVisibilityCondition,
    IPluginReferenceArgumentMapping,
    IWorkflow
} from './workflow';

// How the client, the server and the daemon read argument definitions: which arguments are
// visible, what a submitted config keeps, and how plugin-reference mappings rewrite the
// config of a referenced plugin. Each side must agree, so these rules live next to the model.

type ArgumentValues = Record<string, unknown>;

// A condition compares against the definition's fixed value first, then the submitted value,
// then the default.
const readConditionSourceValue = (
    argumentKey: string,
    definitions: IArgumentDefinition[],
    values: ArgumentValues
): unknown => {
    const referenced = definitions.find((definition) => definition.argument === argumentKey);
    if (referenced?.value !== undefined) {
        return referenced.value;
    }

    if (values[argumentKey] !== undefined) {
        return values[argumentKey];
    }

    return referenced?.default;
};

const matchesCondition = (condition: IArgumentVisibilityCondition, currentValue: unknown): boolean => {
    const comparisonValues: unknown[] = condition.values ?? (condition.value === undefined ? [] : [condition.value]);
    const contains = (candidate: unknown): boolean => comparisonValues.includes(candidate);

    switch (condition.operator) {
        case ArgumentVisibilityOperator.EQUALS:
            return comparisonValues.length > 0 && currentValue === comparisonValues[0];
        case ArgumentVisibilityOperator.NOT_EQUALS:
            return comparisonValues.length > 0 && currentValue !== comparisonValues[0];
        case ArgumentVisibilityOperator.IN:
            return Array.isArray(currentValue) ? currentValue.some(contains) : contains(currentValue);
        case ArgumentVisibilityOperator.NOT_IN:
            return Array.isArray(currentValue) ? !currentValue.some(contains) : !contains(currentValue);
        default:
            return true;
    }
};

// Decides both argument visibleWhen and exposure exportWhen conditions.
export const matchesArgumentCondition = (
    condition: IArgumentVisibilityCondition | undefined,
    definitions: IArgumentDefinition[],
    values: ArgumentValues
): boolean => {
    const argumentKey = condition?.argument?.trim();
    if (!condition || !argumentKey) {
        return true;
    }

    return matchesCondition(condition, readConditionSourceValue(argumentKey, definitions, values));
};

export const isArgumentVisible = (
    definition: IArgumentDefinition,
    definitions: IArgumentDefinition[],
    values: ArgumentValues
): boolean => matchesArgumentCondition(definition.visibleWhen, definitions, values);

// Keeps only the values of visible arguments; inferred arguments are filled by the daemon.
export const sanitizeVisibleArgumentConfig = (
    definitions: IArgumentDefinition[],
    values: ArgumentValues
): ArgumentValues => {
    const sanitized: ArgumentValues = {};

    for (const definition of definitions) {
        if (!definition.argument || definition.inferFromContext || !isArgumentVisible(definition, definitions, values)) {
            continue;
        }

        const value = values[definition.argument];
        if (value === undefined) {
            continue;
        }

        sanitized[definition.argument] = definition.type === ArgumentType.LIST && Array.isArray(value)
            ? value.map((entry) => sanitizeVisibleArgumentConfig(definition.listArguments ?? [], entry as ArgumentValues))
            : value;
    }

    return sanitized;
};

// The value an argument runs with: the submitted value, then the fixed value, then the default.
export const resolveArgumentValue = (definition: IArgumentDefinition | undefined, value: unknown): unknown => {
    if (value !== undefined) {
        return value;
    }

    if (definition?.value !== undefined) {
        return definition.value;
    }

    return definition?.default;
};

export const readWorkflowModifierKey = (workflow: IWorkflow | undefined): string => {
    const key = workflow?.nodes.find((node) => node.type === NodeType.MODIFIER)?.data.modifier?.key;
    return typeof key === 'string' ? key.trim() : '';
};

const normalizeMappings = (mappings: IPluginReferenceArgumentMapping[] | undefined): IPluginReferenceArgumentMapping[] => (
    (mappings ?? []).flatMap((mapping) => {
        const sourceArgument = mapping.sourceArgument?.trim();
        const targetArgument = mapping.targetArgument?.trim();
        if (!sourceArgument || !targetArgument) {
            return [];
        }

        return [{
            ...mapping,
            sourceArgument,
            targetArgument,
            targetPluginId: mapping.targetPluginId?.trim() || undefined,
            targetPluginKey: mapping.targetPluginKey?.trim() || undefined
        }];
    })
);

const resolveMappedValue = (
    mapping: IPluginReferenceArgumentMapping,
    definitions: IArgumentDefinition[],
    values: ArgumentValues
): unknown => {
    const definition = definitions.find((candidate) => candidate.argument === mapping.sourceArgument);
    const value = resolveArgumentValue(definition, values[mapping.sourceArgument]);
    const valueMap = mapping.valueMap;

    if (valueMap && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) {
        const key = String(value);
        if (Object.prototype.hasOwnProperty.call(valueMap, key)) {
            return valueMap[key];
        }
    }

    return value;
};

export interface PluginReferenceMappingTarget{
    pluginId: string;
    // The referenced plugin's modifier key; see readWorkflowModifierKey.
    pluginKey: string;
    config: ArgumentValues;
}

// Applies a pluginReference argument's mappings to the config of one referenced plugin.
export const applyPluginReferenceMappings = (
    target: PluginReferenceMappingTarget,
    definition: IArgumentDefinition,
    definitions: IArgumentDefinition[],
    values: ArgumentValues
): ArgumentValues => {
    const mappings = normalizeMappings(definition.pluginReferenceMappings);
    if (mappings.length === 0) {
        return target.config;
    }

    const config = { ...target.config };
    for (const mapping of mappings) {
        if (mapping.targetPluginId && mapping.targetPluginId !== target.pluginId) {
            continue;
        }

        if (mapping.targetPluginKey && mapping.targetPluginKey !== target.pluginKey) {
            continue;
        }

        const mappedValue = resolveMappedValue(mapping, definitions, values);
        if (mappedValue !== undefined) {
            config[mapping.targetArgument] = mappedValue;
        }
    }

    return config;
};
