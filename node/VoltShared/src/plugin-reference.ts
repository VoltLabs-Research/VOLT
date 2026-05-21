import type { ArgumentDefinitionLike, ArgumentValueMap } from './argument-visibility';
import { resolveArgumentExecutionValue } from './argument-visibility';

export interface PluginReferenceMappingLike {
    sourceArgument?: string;
    targetArgument?: string;
    targetPluginId?: string;
    targetPluginKey?: string;
    valueMap?: Record<string, unknown>;
}

export interface PluginReferenceSelection<TConfig extends Record<string, unknown> = Record<string, unknown>> {
    pluginId: string;
    config: TConfig;
}

export interface PluginReferenceValue<TConfig extends Record<string, unknown> = Record<string, unknown>> {
    selections: Array<PluginReferenceSelection<TConfig>>;
}

export interface PluginReferenceDefinitionLike extends ArgumentDefinitionLike {
    pluginReferenceMappings?: PluginReferenceMappingLike[];
}

export interface NormalizedPluginReferenceMapping {
    sourceArgument: string;
    targetArgument: string;
    targetPluginId?: string;
    targetPluginKey?: string;
    valueMap?: Record<string, unknown>;
}

interface ReadPluginReferenceSelectionsOptions<TConfig extends Record<string, unknown>> {
    isConfigRecord?: (value: unknown) => value is TConfig;
}

interface ApplyPluginReferenceMappingsOptions<TConfig extends Record<string, unknown>> {
    getPluginKey?: (pluginId: string) => string;
    isConfigRecord?: (value: unknown) => value is TConfig;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const readPluginReferenceSelections = <TConfig extends Record<string, unknown> = Record<string, unknown>>(
    value: unknown,
    options: ReadPluginReferenceSelectionsOptions<TConfig> = {}
): Array<PluginReferenceSelection<TConfig>> => {
    const isConfigRecord = options.isConfigRecord ?? ((candidate: unknown): candidate is TConfig => isRecord(candidate));
    const selections = isRecord(value) ? value.selections : undefined;
    if (!Array.isArray(selections)) {
        return [];
    }

    return selections.flatMap((selection) => {
        if (!isRecord(selection) || typeof selection.pluginId !== 'string') {
            return [];
        }

        const pluginId = selection.pluginId.trim();
        if (!pluginId) {
            return [];
        }

        return [{
            pluginId,
            config: isConfigRecord(selection.config) ? selection.config : {} as TConfig
        }];
    });
};

export const normalizePluginReferenceValue = <TConfig extends Record<string, unknown> = Record<string, unknown>>(
    value: unknown,
    options: ReadPluginReferenceSelectionsOptions<TConfig> = {}
): PluginReferenceValue<TConfig> => {
    return {
        selections: readPluginReferenceSelections(value, options)
    };
};

export const normalizePluginReferenceMappings = (
    mappings: PluginReferenceMappingLike[] | undefined
): NormalizedPluginReferenceMapping[] => {
    if (!Array.isArray(mappings)) {
        return [];
    }

    return mappings.flatMap((mapping) => {
        if (!mapping || typeof mapping !== 'object') {
            return [];
        }

        const sourceArgument = typeof mapping.sourceArgument === 'string'
            ? mapping.sourceArgument.trim()
            : '';
        const targetArgument = typeof mapping.targetArgument === 'string'
            ? mapping.targetArgument.trim()
            : '';

        if (!sourceArgument || !targetArgument) {
            return [];
        }

        const targetPluginId = typeof mapping.targetPluginId === 'string'
            ? mapping.targetPluginId.trim()
            : '';
        const targetPluginKey = typeof mapping.targetPluginKey === 'string'
            ? mapping.targetPluginKey.trim()
            : '';

        return [{
            sourceArgument,
            targetArgument,
            ...(targetPluginId ? { targetPluginId } : {}),
            ...(targetPluginKey ? { targetPluginKey } : {}),
            ...(isRecord(mapping.valueMap) ? { valueMap: mapping.valueMap } : {})
        }];
    });
};

export const resolveMappingSourceValue = <TDefinition extends PluginReferenceDefinitionLike>(
    mapping: NormalizedPluginReferenceMapping,
    definitions: readonly TDefinition[],
    values: ArgumentValueMap
): unknown => {
    const sourceDefinition = definitions.find((definition) => definition.argument === mapping.sourceArgument);
    const resolvedValue = sourceDefinition
        ? resolveArgumentExecutionValue(sourceDefinition, values[mapping.sourceArgument])
        : values[mapping.sourceArgument];

    if (!isRecord(mapping.valueMap)) {
        return resolvedValue;
    }

    if (typeof resolvedValue === 'string' || typeof resolvedValue === 'number' || typeof resolvedValue === 'boolean') {
        const valueMapKey = String(resolvedValue);
        if (Object.prototype.hasOwnProperty.call(mapping.valueMap, valueMapKey)) {
            return mapping.valueMap[valueMapKey];
        }
    }

    return resolvedValue;
};

export const applyPluginReferenceMappings = <
    TDefinition extends PluginReferenceDefinitionLike,
    TConfig extends Record<string, unknown> = Record<string, unknown>
>(
    target: {
        pluginId: string;
        config: TConfig;
        definition: TDefinition;
        definitions: readonly TDefinition[];
        values: ArgumentValueMap;
    },
    options: ApplyPluginReferenceMappingsOptions<TConfig> = {}
): TConfig => {
    const mappings = normalizePluginReferenceMappings(target.definition.pluginReferenceMappings);
    if (mappings.length === 0) {
        return target.config;
    }

    const getPluginKey = options.getPluginKey ?? (() => '');
    const config: Record<string, unknown> = { ...target.config };
    const pluginKey = getPluginKey(target.pluginId);

    for (const mapping of mappings) {
        if (mapping.targetPluginId && mapping.targetPluginId !== target.pluginId) {
            continue;
        }

        if (mapping.targetPluginKey && mapping.targetPluginKey !== pluginKey) {
            continue;
        }

        const mappedValue = resolveMappingSourceValue(mapping, target.definitions, target.values);
        if (mappedValue === undefined) {
            continue;
        }

        config[mapping.targetArgument] = mappedValue;
    }

    return config as TConfig;
};
