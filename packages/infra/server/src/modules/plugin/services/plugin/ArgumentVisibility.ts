import {
    ArgumentType,
    type ArgumentDefinition,
    type ArgumentVisibilityCondition
} from '@modules/plugin/models/plugin/workflow/WorkflowTypes';

type ArgumentValueMap = Record<string, unknown>;

const getConditionValues = (condition: ArgumentVisibilityCondition): unknown[] => {
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
            return currentValue.some((entry) => comparisonValues.includes(entry));
        }

        return comparisonValues.includes(currentValue);
    }

    if (condition.operator === 'notIn') {
        if (Array.isArray(currentValue)) {
            return currentValue.every((entry) => !comparisonValues.includes(entry));
        }

        return !comparisonValues.includes(currentValue);
    }

    return true;
};

export const matchesArgumentCondition = (
    condition: ArgumentVisibilityCondition | undefined,
    definitions: ArgumentDefinition[],
    values: ArgumentValueMap
): boolean => {
    if (!condition) {
        return true;
    }

    const controllingArgumentKey = condition.argument?.trim();
    if (!controllingArgumentKey) {
        return true;
    }

    const currentValue = resolveComparisonSourceValue(definitions, values, controllingArgumentKey);
    return matchesVisibilityCondition(condition, currentValue);
};

export const isArgumentVisible = (
    definition: ArgumentDefinition,
    definitions: ArgumentDefinition[],
    values: ArgumentValueMap
): boolean => matchesArgumentCondition(definition.visibleWhen, definitions, values);

export const sanitizeVisibleArgumentConfig = (
    definitions: ArgumentDefinition[],
    values: ArgumentValueMap
): ArgumentValueMap => {
    const sanitizedValues: ArgumentValueMap = {};

    for (const definition of definitions) {
        if (
            !definition.argument
            || definition.inferFromContext
            || !isArgumentVisible(definition, definitions, values)
        ) {
            continue;
        }

        const value = values[definition.argument];
        if (value === undefined) {
            continue;
        }

        if (definition.type === ArgumentType.LIST && Array.isArray(value)) {
            sanitizedValues[definition.argument] = value.map((entry) => {
                return sanitizeVisibleArgumentConfig(definition.listArguments ?? [], entry as ArgumentValueMap);
            });
            continue;
        }

        sanitizedValues[definition.argument] = value;
    }

    return sanitizedValues;
};
