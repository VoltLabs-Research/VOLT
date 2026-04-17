import type { WorkflowArgumentDefinition, WorkflowArgumentVisibilityCondition } from '@/contracts';
import type { WorkflowExecutionContext, WorkflowNode, WorkflowNodeOutput } from '@/modules/analysis/contracts/workflow.types';
import type { WorkflowNodeHandler, WorkflowNodeRegistry } from '@/modules/analysis/application/workflow';
import type { WorkflowPluginReferenceValueWithSelections } from '@/modules/analysis/application/workflow/InlineWorkflowShared';
import { resolveWorkflowExpressionValue, shouldResolveWorkflowExpression } from '@/modules/analysis/application/workflow/WorkflowExpressionResolution';
import { encodeCliArgumentsToken, stringifyUnknown } from '@/support/serialization/serialization';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';

interface PluginReferencePlanningItem {
    referencePath: string;
    pluginId: string;
    config: WorkflowNodeOutput;
};

const getVisibilityConditionValues = (
    condition: WorkflowArgumentVisibilityCondition
): Array<string | number | boolean> => {
    return condition.values ?? (condition.value === undefined ? [] : [condition.value]);
};

const matchesVisibilityCondition = (
    condition: WorkflowArgumentVisibilityCondition,
    currentValue: WorkflowNodeOutput[string]
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
    values: WorkflowNodeOutput
): boolean => {
    if (!definition.visibleWhen?.argument) {
        return true;
    }

    const referencedDefinition = definitions.find((candidate) => candidate.argument === definition.visibleWhen?.argument);
    const currentValue = referencedDefinition?.value !== undefined
        ? referencedDefinition.value
        : values[definition.visibleWhen.argument] !== undefined
            ? values[definition.visibleWhen.argument]
            : referencedDefinition?.default;

    return matchesVisibilityCondition(definition.visibleWhen, currentValue as WorkflowNodeOutput[string]);
};

const collectPluginReferences = (
    definitions: WorkflowArgumentDefinition[],
    definition: WorkflowArgumentDefinition,
    value: WorkflowNodeOutput[string],
    scopeValues: WorkflowNodeOutput,
    currentPath: string,
    results: PluginReferencePlanningItem[]
): void => {
    if (!isArgumentVisible(definition, definitions, scopeValues)) {
        return;
    }

    const resolvedValue = value !== undefined ? value : definition.value !== undefined ? definition.value : definition.default;

    if (definition.type === 'pluginReference') {
        for (const selection of (resolvedValue as WorkflowPluginReferenceValueWithSelections).selections) {
            results.push({
                referencePath: currentPath,
                pluginId: selection.pluginId,
                config: selection.config
            });
        }
        return;
    }

    if (definition.type === 'list' && Array.isArray(resolvedValue)) {
        const nestedDefinitions = definition.listArguments ?? [];
        resolvedValue.forEach((entry, index) => {
            const item = entry as WorkflowNodeOutput;

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

    constructor(private readonly registry: WorkflowNodeRegistry) {}

    async execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<WorkflowNodeOutput> {
        const persistedDefinitions = node.data.arguments?.arguments ?? [];
        const definitions = [
            ...persistedDefinitions,
            ...createRuntimeArgumentDefinitions(context, persistedDefinitions)
        ];

        const values: WorkflowNodeOutput = {};
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

            if (shouldResolveWorkflowExpression(value)) {
                value = await resolveWorkflowExpressionValue(
                    value,
                    this.registry,
                    context,
                    node.id
                );
            }

            values[argumentKey] = value as WorkflowNodeOutput[string];
        }

        for (const definition of definitions) {
            const argumentKey = definition.argument;
            if (!argumentKey || !isArgumentVisible(definition, definitions, values)) {
                continue;
            }

            const value = values[argumentKey];
            if (value !== null && value !== undefined) {
                if (definition.type === 'boolean') {
                    if (value === true || value === 'true') {
                        cliArgs.push(`--${argumentKey}`);
                    }
                } else if (definition.type === 'select' && definition.multipleSelection) {
                    const selectedValues = Array.isArray(value) ? value : value ? [value] : [];

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
