import {
    ArgumentType,
    type ArgumentDefinition,
    type ArgumentVisibilityCondition
} from '@modules/plugin/domain/entities/plugin/workflow/nodes/ArgumentNode';

type ArgumentValueMap = Record<string, unknown>;
type VisibilityComparableValue = string | number | boolean;

const getConditionValues = (condition: ArgumentVisibilityCondition): VisibilityComparableValue[] => {
    return condition.values ?? (condition.value === undefined ? [] : [condition.value]);
};

const resolveComparisonSourceValue = (
    definitions: ArgumentDefinition[],
    values: ArgumentValueMap,
    argumentKey: string
): unknown => {
    const referencedDefinition = definitions.find((definition) => definition.argument === argumentKey);
    if (!referencedDefinition) {
        return values[argumentKey];
    }

    if (referencedDefinition.value !== undefined) {
        return referencedDefinition.value;
    }

    if (values[argumentKey] !== undefined) {
        return values[argumentKey];
    }

    return referencedDefinition.default;
};

const matchesVisibilityCondition = (
    condition: ArgumentVisibilityCondition,
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

export const isArgumentVisible = (
    definition: ArgumentDefinition,
    definitions: ArgumentDefinition[],
    values: ArgumentValueMap
): boolean => {
    if (!definition.visibleWhen) {
        return true;
    }

    const controllingArgumentKey = definition.visibleWhen.argument.trim();
    if (!controllingArgumentKey) {
        return true;
    }

    const currentValue = resolveComparisonSourceValue(definitions, values, controllingArgumentKey);
    return matchesVisibilityCondition(definition.visibleWhen, currentValue);
};

export const sanitizeVisibleArgumentConfig = (
    definitions: ArgumentDefinition[],
    values: ArgumentValueMap
): ArgumentValueMap => {
    const sanitizedValues: ArgumentValueMap = {};

    for (const definition of definitions) {
        if (!definition.argument || !isArgumentVisible(definition, definitions, values)) {
            continue;
        }

        const value = values[definition.argument];
        if (value === undefined) {
            continue;
        }

        if (definition.type === ArgumentType.List && Array.isArray(value)) {
            sanitizedValues[definition.argument] = value.map((entry) => {
                return sanitizeVisibleArgumentConfig(definition.listArguments ?? [], entry as ArgumentValueMap);
            });
            continue;
        }

        sanitizedValues[definition.argument] = value;
    }

    return sanitizedValues;
};
