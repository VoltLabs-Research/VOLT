import type { WorkflowArgumentDefinition, WorkflowArgumentVisibilityCondition } from '@/contracts';
import type { WorkflowExecutionContext, WorkflowNode } from '@/modules/analysis/contracts/workflow.types';
import type { WorkflowNodeHandler, WorkflowNodeRegistry } from '@/modules/analysis/application/workflow';
import { encodeCliArgumentsToken, stringifyUnknown } from '@/support/serialization/serialization';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import { readWorkflowPluginReferenceSelections } from '@/modules/analysis/application/workflow/InlineWorkflowShared';

interface PluginReferencePlanningItem {
    referencePath: string;
    pluginId: string;
    config: Record<string, unknown>;
};

const getVisibilityConditionValues = (
    condition: WorkflowArgumentVisibilityCondition
): Array<string | number | boolean> => {
    return condition.values ?? (condition.value === undefined ? [] : [condition.value]);
};

const resolveDefinitionValue = (
    definitions: WorkflowArgumentDefinition[],
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
    condition: WorkflowArgumentVisibilityCondition,
    currentValue: unknown
): boolean => {
    const comparisonValues = getVisibilityConditionValues(condition);

    if (condition.operator === 'equals') {
        return comparisonValues.length > 0 && currentValue === comparisonValues[0];
    }

    if (condition.operator === 'notEquals') {
        return comparisonValues.length > 0 && currentValue !== comparisonValues[0];
    }

    if (condition.operator === 'in') {
        if (Array.isArray(currentValue)) {
            return currentValue.some((entry) => comparisonValues.includes(entry as string | number | boolean));
        }

        return comparisonValues.includes(currentValue as string | number | boolean);
    }

    if (condition.operator === 'notIn') {
        if (Array.isArray(currentValue)) {
            return currentValue.every((entry) => !comparisonValues.includes(entry as string | number | boolean));
        }

        return !comparisonValues.includes(currentValue as string | number | boolean);
    }

    return true;
};

const isArgumentVisible = (
    definition: WorkflowArgumentDefinition,
    definitions: WorkflowArgumentDefinition[],
    values: Record<string, unknown>
): boolean => {
    if (!definition.visibleWhen?.argument) {
        return true;
    }

    const currentValue = resolveDefinitionValue(definitions, values, definition.visibleWhen.argument);
    return matchesVisibilityCondition(definition.visibleWhen, currentValue);
};

const resolveRuntimeArgumentValue = (
    definition: WorkflowArgumentDefinition,
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
    definitions: WorkflowArgumentDefinition[],
    definition: WorkflowArgumentDefinition,
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
                pluginId: selection.pluginId,
                config: selection.config ?? {}
            });
        }
        return;
    }

    if (definition.type === 'list' && Array.isArray(resolvedValue)) {
        const nestedDefinitions = definition.listArguments ?? [];
        resolvedValue.forEach((entry, index) => {
            const item = entry as Record<string, unknown>;

            for (const nestedDefinition of nestedDefinitions) {
                if (!nestedDefinition.argument) {
                    continue;
                }

                collectPluginReferences(
                    nestedDefinitions,
                    nestedDefinition,
                    item[nestedDefinition.argument],
                    item,
                    `${currentPath}[${index}].${nestedDefinition.argument}`,
                    results
                );
            }
        });
    }
};

const RESERVED_RUNTIME_ARGUMENTS = {
    selectedTimesteps: 'selectedTimesteps'
} as const;

const hasArgumentDefinition = (definitions: WorkflowArgumentDefinition[], argumentKey: string): boolean => {
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
    persistedDefinitions: WorkflowArgumentDefinition[]
): WorkflowArgumentDefinition[] => {
    const definitions: WorkflowArgumentDefinition[] = [];
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

    constructor(
        private readonly registry: WorkflowNodeRegistry
    ) {}

    async execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<Record<string, unknown>> {
        const persistedDefinitions = node.data.arguments?.arguments ?? [];
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
