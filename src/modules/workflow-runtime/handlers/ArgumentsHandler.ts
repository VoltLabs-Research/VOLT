import type { WorkflowExecutionContext, WorkflowNode } from '../contracts';
import type { WorkflowNodeHandler, WorkflowNodeRegistry } from '../services';
import { encodeCliArgumentsToken, stringifyUnknown } from '@/shared/utils';
import { isRecord } from '@/shared/utilities/type-guards';
import { WorkflowNodeType } from '../contracts';
import { readWorkflowPluginReferenceSelections } from '../services/InlineWorkflowShared';

interface ArgumentDefinition {
    argument?: string;
    type?: string;
    value?: unknown;
    default?: unknown;
    optionsFromArguments?: ArgumentOptionSource[];
    listArguments?: ArgumentDefinition[];
    listItemLabelArgument?: string;
    multipleSelection?: boolean;
    visibleWhen?: ArgumentVisibilityCondition;
};

interface ArgumentOptionSource {
    argument?: string;
    valueField?: string;
    labelField?: string;
};

interface ArgumentVisibilityCondition {
    argument?: string;
    operator?: 'equals' | 'notEquals' | 'in' | 'notIn';
    value?: string | number | boolean;
    values?: Array<string | number | boolean>;
};

interface PluginReferencePlanningItem {
    referencePath: string;
    pluginId: string;
    config: Record<string, unknown>;
};

const isVisibilityComparableValue = (value: unknown): value is string | number | boolean => {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
};

const normalizeComparableValue = (
    candidateValue: unknown,
    referenceValue: string | number | boolean
): string | number | boolean | unknown => {
    if (typeof referenceValue === 'boolean') {
        if (typeof candidateValue === 'string') {
            const trimmedValue = candidateValue.trim().toLowerCase();
            if (trimmedValue === 'true') {
                return true;
            }
            if (trimmedValue === 'false') {
                return false;
            }
        }

        if (typeof candidateValue === 'number') {
            if (candidateValue === 1) return true;
            if (candidateValue === 0) return false;
        }
    }

    if (typeof referenceValue === 'number' && typeof candidateValue === 'string') {
        const trimmedValue = candidateValue.trim();
        if (trimmedValue.length > 0) {
            const parsedValue = Number(trimmedValue);
            if (Number.isFinite(parsedValue)) {
                return parsedValue;
            }
        }
    }

    if (typeof referenceValue === 'string') {
        if (typeof candidateValue === 'number' || typeof candidateValue === 'boolean') {
            return String(candidateValue);
        }
    }

    return candidateValue;
};

const matchesComparisonValue = (
    candidateValue: unknown,
    comparisonValue: string | number | boolean
): boolean => {
    return normalizeComparableValue(candidateValue, comparisonValue) === comparisonValue;
};

const normalizeVisibilityConditionValues = (
    condition: ArgumentVisibilityCondition
): Array<string | number | boolean> => {
    if (Array.isArray(condition.values)) {
        return condition.values.filter(isVisibilityComparableValue);
    }

    if (isVisibilityComparableValue(condition.value)) {
        return [condition.value];
    }

    return [];
};

const resolveDefinitionValue = (
    definitions: ArgumentDefinition[],
    values: Record<string, unknown>,
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
    const comparisonValues = normalizeVisibilityConditionValues(condition);

    if (condition.operator === 'equals') {
        return comparisonValues.length > 0 && matchesComparisonValue(currentValue, comparisonValues[0]);
    }

    if (condition.operator === 'notEquals') {
        return comparisonValues.length > 0 && !matchesComparisonValue(currentValue, comparisonValues[0]);
    }

    if (condition.operator === 'in') {
        if (Array.isArray(currentValue)) {
            return currentValue.some((entry) => comparisonValues.some((comparisonValue) => {
                return matchesComparisonValue(entry, comparisonValue);
            }));
        }

        return comparisonValues.some((comparisonValue) => matchesComparisonValue(currentValue, comparisonValue));
    }

    if (condition.operator === 'notIn') {
        if (Array.isArray(currentValue)) {
            return currentValue.every((entry) => comparisonValues.every((comparisonValue) => {
                return !matchesComparisonValue(entry, comparisonValue);
            }));
        }

        return comparisonValues.every((comparisonValue) => !matchesComparisonValue(currentValue, comparisonValue));
    }

    return true;
};

const isArgumentVisible = (
    definition: ArgumentDefinition,
    definitions: ArgumentDefinition[],
    values: Record<string, unknown>
): boolean => {
    if (!definition.visibleWhen?.argument) {
        return true;
    }

    const currentValue = resolveDefinitionValue(definitions, values, definition.visibleWhen.argument);
    return matchesVisibilityCondition(definition.visibleWhen, currentValue);
};

const resolveRuntimeArgumentValue = (
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

const collectPluginReferences = (
    definitions: ArgumentDefinition[],
    definition: ArgumentDefinition,
    value: unknown,
    scopeValues: Record<string, unknown>,
    currentPath: string,
    results: PluginReferencePlanningItem[]
): void => {
    if (!isArgumentVisible(definition, definitions, scopeValues)) {
        return;
    }

    const resolvedValue = resolveRuntimeArgumentValue(definition, value);

    if (definition.type === 'pluginReference') {
        for (const selection of readWorkflowPluginReferenceSelections(resolvedValue)) {
            results.push({
                referencePath: currentPath,
                pluginId: selection.pluginId.trim(),
                config: selection.config
            });
        }
        return;
    }

    if (definition.type === 'list' && Array.isArray(resolvedValue)) {
        const nestedDefinitions = definition.listArguments ?? [];
        resolvedValue.forEach((entry, index) => {
            if (!isRecord(entry)) {
                return;
            }

            for (const nestedDefinition of nestedDefinitions) {
                if (!nestedDefinition.argument) {
                    continue;
                }

                collectPluginReferences(
                    nestedDefinitions,
                    nestedDefinition,
                    entry[nestedDefinition.argument],
                    entry,
                    `${currentPath}[${index}].${nestedDefinition.argument}`,
                    results
                );
            }
        });
    }
};

interface ArgumentsNodeData {
    arguments?: ArgumentDefinition[];
};

interface ArgumentsNodePayload {
    arguments?: ArgumentsNodeData;
};

const RESERVED_RUNTIME_ARGUMENTS = {
    selectedTimesteps: 'selectedTimesteps'
} as const;

const hasArgumentDefinition = (definitions: ArgumentDefinition[], argumentKey: string): boolean => {
    return definitions.some((definition) => {
        if (definition.argument === argumentKey) {
            return true;
        }

        return definition.listArguments
            ? hasArgumentDefinition(definition.listArguments, argumentKey)
            : false;
    });
};

const createRuntimeArgumentDefinitions = (
    context: WorkflowExecutionContext,
    persistedDefinitions: ArgumentDefinition[]
): ArgumentDefinition[] => {
    const definitions: ArgumentDefinition[] = [];
    const hasReservedArgument = hasArgumentDefinition(
        persistedDefinitions,
        RESERVED_RUNTIME_ARGUMENTS.selectedTimesteps
    );

    if (!hasReservedArgument && context.runtimeArguments[RESERVED_RUNTIME_ARGUMENTS.selectedTimesteps] !== undefined) {
        definitions.push({
            argument: RESERVED_RUNTIME_ARGUMENTS.selectedTimesteps,
            type: 'list'
        });
    }

    return definitions;
};

export class WorkflowArgumentsHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.Arguments;
    readonly outputSchema = { properties: {} };

    constructor(
        private readonly registry: WorkflowNodeRegistry
    ) {}

    async execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<Record<string, unknown>> {
        const nodeData = node.data as ArgumentsNodePayload;
        const persistedDefinitions = nodeData.arguments?.arguments ?? [];
        const definitions = [
            ...persistedDefinitions,
            ...createRuntimeArgumentDefinitions(context, persistedDefinitions)
        ];

        const values: Record<string, unknown> = {};
        const cliArgs: string[] = [];

        for (const definition of definitions) {
            const argumentKey = definition.argument;
            if (!argumentKey) {
                continue;
            }

            let value = definition.value;
            if (value === undefined && context.userConfig[argumentKey] !== undefined) {
                value = context.userConfig[argumentKey];
            }
            if (value === undefined && context.runtimeArguments[argumentKey] !== undefined) {
                value = context.runtimeArguments[argumentKey];
            }
            if (value === undefined) {
                value = definition.default;
            }

            if (typeof value === 'string' && value.includes('{{')) {
                value = this.registry.resolveTemplate(value, context, node.id);
            }

            values[argumentKey] = value;
        }

        for (const definition of definitions) {
            const argumentKey = definition.argument;
            if (!argumentKey || !isArgumentVisible(definition, definitions, values)) {
                continue;
            }

            const value = values[argumentKey];
            if (value !== null && value !== undefined) {
                if (definition.type === 'boolean') {
                    if (String(value) === 'true') {
                        cliArgs.push(`--${argumentKey}`);
                    }
                } else if (definition.type === 'select' && definition.multipleSelection) {
                    const selectedValues = Array.isArray(value)
                        ? value.filter((entry): entry is string => typeof entry === 'string')
                        : typeof value === 'string' && value.trim().length > 0
                            ? [value]
                            : [];

                    if (selectedValues.length > 0) {
                        cliArgs.push(`--${argumentKey}`, selectedValues.join(','));
                    }
                } else if (definition.type === 'pluginReference') {
                    continue;
                } else {
                    const serializedValue = stringifyUnknown(value);
                    cliArgs.push(`--${argumentKey}`, serializedValue);
                }
            }
        }

        const pluginReferences: PluginReferencePlanningItem[] = [];
        for (const definition of definitions) {
            const argumentKey = definition.argument;
            if (!argumentKey || !isArgumentVisible(definition, definitions, values)) {
                continue;
            }

            collectPluginReferences(definitions, definition, values[argumentKey], values, argumentKey, pluginReferences);
        }

        const visibleValues = Object.fromEntries(definitions
            .filter((definition) => definition.argument && isArgumentVisible(definition, definitions, values))
            .map((definition) => [definition.argument as string, values[definition.argument as string]])
        );

        return {
            as_str: encodeCliArgumentsToken(cliArgs),
            as_array: cliArgs,
            pluginReferences: {
                items: pluginReferences,
                str_json: JSON.stringify(pluginReferences)
            },
            ...visibleValues
        };
    }
}
