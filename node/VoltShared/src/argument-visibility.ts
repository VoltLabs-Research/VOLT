export type ArgumentValueMap = Record<string, unknown>;
export type VisibilityComparableValue = string | number | boolean;

export interface ArgumentVisibilityConditionLike {
    argument?: string;
    operator?: 'equals' | 'notEquals' | 'in' | 'notIn' | string;
    value?: VisibilityComparableValue;
    values?: VisibilityComparableValue[];
}

export interface ArgumentDefinitionLike {
    argument?: string;
    type?: unknown;
    default?: unknown;
    value?: unknown;
    listArguments?: ArgumentDefinitionLike[];
    visibleWhen?: ArgumentVisibilityConditionLike;
}

interface SanitizeVisibleArgumentConfigOptions<TDefinition extends ArgumentDefinitionLike> {
    isListDefinition?: (definition: TDefinition) => boolean;
}

const getConditionValues = (
    condition: ArgumentVisibilityConditionLike
): VisibilityComparableValue[] => {
    return condition.values ?? (condition.value === undefined ? [] : [condition.value]);
};

export const resolveArgumentExecutionValue = <TDefinition extends Pick<ArgumentDefinitionLike, 'default' | 'value'>>(
    definition: TDefinition,
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

export const resolveComparisonSourceValue = <TDefinition extends ArgumentDefinitionLike>(
    definitions: readonly TDefinition[],
    values: ArgumentValueMap,
    argumentKey: string
): unknown => {
    const referencedDefinition = definitions.find((definition) => definition.argument === argumentKey);
    if (!referencedDefinition) {
        return values[argumentKey];
    }

    return resolveArgumentExecutionValue(referencedDefinition, values[argumentKey]);
};

export const matchesVisibilityCondition = (
    condition: ArgumentVisibilityConditionLike,
    currentValue: unknown
): boolean => {
    const comparisonValues = getConditionValues(condition);

    if (condition.operator === 'equals') {
        return comparisonValues.length > 0 && currentValue === comparisonValues[0];
    }

    if (condition.operator === 'notEquals') {
        return comparisonValues.length > 0 && currentValue !== comparisonValues[0];
    }

    if (condition.operator === 'in') {
        if (Array.isArray(currentValue)) {
            return currentValue.some((entry) => comparisonValues.includes(entry as VisibilityComparableValue));
        }

        return comparisonValues.includes(currentValue as VisibilityComparableValue);
    }

    if (condition.operator === 'notIn') {
        if (Array.isArray(currentValue)) {
            return currentValue.every((entry) => !comparisonValues.includes(entry as VisibilityComparableValue));
        }

        return !comparisonValues.includes(currentValue as VisibilityComparableValue);
    }

    return true;
};

export const isArgumentVisible = <TDefinition extends ArgumentDefinitionLike>(
    definition: TDefinition,
    definitions: readonly TDefinition[],
    values: ArgumentValueMap
): boolean => {
    if (!definition.visibleWhen) {
        return true;
    }

    const controllingArgumentKey = definition.visibleWhen.argument?.trim() ?? '';
    if (!controllingArgumentKey) {
        return true;
    }

    const currentValue = resolveComparisonSourceValue(definitions, values, controllingArgumentKey);
    return matchesVisibilityCondition(definition.visibleWhen, currentValue);
};

export const getVisibleArguments = <TDefinition extends ArgumentDefinitionLike>(
    definitions: readonly TDefinition[],
    values: ArgumentValueMap
): TDefinition[] => {
    return definitions.filter((definition) => isArgumentVisible(definition, definitions, values));
};

export const sanitizeVisibleArgumentConfig = <TDefinition extends ArgumentDefinitionLike>(
    definitions: readonly TDefinition[],
    values: ArgumentValueMap,
    options: SanitizeVisibleArgumentConfigOptions<TDefinition> = {}
): ArgumentValueMap => {
    const sanitizedValues: ArgumentValueMap = {};
    const isListDefinition = options.isListDefinition ?? ((definition: TDefinition) => definition.type === 'list');

    for (const definition of definitions) {
        if (!definition.argument || !isArgumentVisible(definition, definitions, values)) {
            continue;
        }

        const value = values[definition.argument];
        if (value === undefined) {
            continue;
        }

        if (isListDefinition(definition) && Array.isArray(value)) {
            sanitizedValues[definition.argument] = value.map((entry) => {
                return sanitizeVisibleArgumentConfig(
                    (definition.listArguments ?? []) as TDefinition[],
                    entry as ArgumentValueMap,
                    options as SanitizeVisibleArgumentConfigOptions<TDefinition>
                );
            });
            continue;
        }

        sanitizedValues[definition.argument] = value;
    }

    return sanitizedValues;
};
