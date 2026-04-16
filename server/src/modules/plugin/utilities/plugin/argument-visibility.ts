import {
    ArgumentType,
    type ArgumentDefinition,
    type ArgumentVisibilityCondition
} from '@modules/plugin/domain/entities/plugin/workflow/nodes/ArgumentNode';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';

type ArgumentValueMap = Record<string, unknown>;
type VisibilityComparableValue = string | number | boolean;

const isVisibilityComparableValue = (value: unknown): value is VisibilityComparableValue => {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
};

const normalizeConditionValues = (condition: ArgumentVisibilityCondition): VisibilityComparableValue[] => {
    if (Array.isArray(condition.values)) {
        return condition.values.filter(isVisibilityComparableValue);
    }

    if (isVisibilityComparableValue(condition.value)) {
        return [condition.value];
    }

    return [];
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
    const comparisonValues = normalizeConditionValues(condition);

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

const sanitizeListValue = (
    definition: ArgumentDefinition,
    value: unknown
): unknown => {
    if (definition.type !== ArgumentType.List || !Array.isArray(value)) {
        return value;
    }

    const nestedDefinitions = definition.listArguments ?? [];
    return value
        .filter(isRecord)
        .map((entry) => sanitizeVisibleArgumentConfig(nestedDefinitions, entry));
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

        sanitizedValues[definition.argument] = sanitizeListValue(definition, value);
    }

    return sanitizedValues;
};
