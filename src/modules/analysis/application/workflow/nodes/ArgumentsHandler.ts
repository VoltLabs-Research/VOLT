import type { WorkflowArgumentDefinition, WorkflowArgumentVisibilityCondition } from '@/contracts';
import type { WorkflowExecutionContext, WorkflowNode, WorkflowNodeOutput } from '@/modules/analysis/contracts/workflow.types';
import type { WorkflowNodeHandler, WorkflowNodeRegistry } from '@/modules/analysis/application/workflow/NodeRegistry';
import type { WorkflowPluginReferenceValueWithSelections } from '@/modules/analysis/application/workflow/WorkflowRuntime';
import { encodeCliArgumentsToken, stringifyUnknown } from '@/support/serialization/serialization';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';

interface PluginReferencePlanningItem {
    referencePath: string;
    pluginId: string;
    config: WorkflowNodeOutput;
}

export class WorkflowArgumentsHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.Arguments;
    private static readonly RESERVED_RUNTIME_ARGUMENTS = {
        selectedTimesteps: 'selectedTimesteps'
    } as const;

    constructor(private readonly registry: WorkflowNodeRegistry) {}

    async execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<WorkflowNodeOutput> {
        const persistedDefinitions = node.data.arguments?.arguments
            ? node.data.arguments.arguments
            : [];
        const definitions = [
            ...persistedDefinitions,
            ...this.createRuntimeArgumentDefinitions(context, persistedDefinitions)
        ];

        const values: WorkflowNodeOutput = {};
        const cliArgs: string[] = [];

        for (const definition of definitions) {
            const argumentKey = definition.argument;
            if (!argumentKey) {
                continue;
            }

            let value = definition.value as WorkflowNodeOutput[string] | undefined;
            if (value === undefined && context.userConfig[argumentKey] !== undefined) {
                value = context.userConfig[argumentKey] as WorkflowNodeOutput[string];
            }
            if (value === undefined && context.runtimeArguments[argumentKey] !== undefined) {
                value = context.runtimeArguments[argumentKey] as WorkflowNodeOutput[string];
            }
            if (value === undefined) {
                value = definition.default as WorkflowNodeOutput[string] | undefined;
            }

            if (this.registry.shouldResolveExpression(value)) {
                value = await this.registry.resolveExpressionValue(
                    value,
                    context,
                    node.id
                );
            }

            values[argumentKey] = value as WorkflowNodeOutput[string];
        }

        for (const definition of definitions) {
            const argumentKey = definition.argument;
            if (!argumentKey || !this.isArgumentVisible(definition, definitions, values)) {
                continue;
            }

            const value = values[argumentKey];
            if (value !== null && value !== undefined) {
                if (definition.type === 'boolean') {
                    if (value === true || value === 'true') {
                        cliArgs.push(`--${argumentKey}`);
                    }
                } else if (definition.type === 'select' && definition.multipleSelection) {
                    const selectedValues = value instanceof Array
                        ? value
                        : value === null || value === undefined
                            ? []
                            : [value];

                    if (selectedValues.length > 0) {
                        cliArgs.push(`--${argumentKey}`, selectedValues.join(','));
                    }
                } else if (definition.type === 'pluginReference') {
                    continue;
                } else {
                    const serializedValue = stringifyUnknown(value as Parameters<typeof stringifyUnknown>[0]);
                    cliArgs.push(`--${argumentKey}`, serializedValue);
                }
            }
        }

        const pluginReferences: PluginReferencePlanningItem[] = [];
        for (const definition of definitions) {
            const argumentKey = definition.argument;
            if (!argumentKey || !this.isArgumentVisible(definition, definitions, values)) {
                continue;
            }

            this.collectPluginReferences(definitions, definition, values[argumentKey], values, argumentKey, pluginReferences);
        }

        const visibleValues = Object.fromEntries(definitions
            .filter((definition) => definition.argument && this.isArgumentVisible(definition, definitions, values))
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

    private getVisibilityConditionValues(
        condition: WorkflowArgumentVisibilityCondition
    ): Array<string | number | boolean> {
        if (condition.values) {
            return condition.values;
        }

        if (condition.value === undefined) {
            return [];
        }

        return [condition.value];
    }

    private matchesVisibilityCondition(
        condition: WorkflowArgumentVisibilityCondition,
        currentValue: WorkflowNodeOutput[string]
    ): boolean {
        const comparisonValues = this.getVisibilityConditionValues(condition);

        if (condition.operator === 'equals') {
            return comparisonValues.length > 0 && currentValue === comparisonValues[0];
        }

        if (condition.operator === 'notEquals') {
            return comparisonValues.length > 0 && currentValue !== comparisonValues[0];
        }

        if (condition.operator === 'in') {
            if (currentValue instanceof Array) {
                return currentValue.some((entry) => comparisonValues.includes(entry as string | number | boolean));
            }

            return comparisonValues.includes(currentValue as string | number | boolean);
        }

        if (condition.operator === 'notIn') {
            if (currentValue instanceof Array) {
                return currentValue.every((entry) => !comparisonValues.includes(entry as string | number | boolean));
            }

            return !comparisonValues.includes(currentValue as string | number | boolean);
        }

        return true;
    }

    private isArgumentVisible(
        definition: WorkflowArgumentDefinition,
        definitions: WorkflowArgumentDefinition[],
        values: WorkflowNodeOutput
    ): boolean {
        if (!definition.visibleWhen?.argument) {
            return true;
        }

        const referencedDefinition = definitions.find((candidate) => candidate.argument === definition.visibleWhen?.argument);
        const currentValue = referencedDefinition?.value !== undefined
            ? referencedDefinition.value
            : values[definition.visibleWhen.argument] !== undefined
                ? values[definition.visibleWhen.argument]
                : referencedDefinition?.default;

        return this.matchesVisibilityCondition(definition.visibleWhen, currentValue as WorkflowNodeOutput[string]);
    }

    private collectPluginReferences(
        definitions: WorkflowArgumentDefinition[],
        definition: WorkflowArgumentDefinition,
        value: WorkflowNodeOutput[string],
        scopeValues: WorkflowNodeOutput,
        currentPath: string,
        results: PluginReferencePlanningItem[]
    ): void {
        if (!this.isArgumentVisible(definition, definitions, scopeValues)) {
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

        if (definition.type === 'list' && resolvedValue instanceof Array) {
            const nestedDefinitions = definition.listArguments
                ? definition.listArguments
                : [];
            resolvedValue.forEach((entry, index) => {
                const item = entry as WorkflowNodeOutput;

                for (const nestedDefinition of nestedDefinitions) {
                    if (!nestedDefinition.argument) {
                        continue;
                    }

                    this.collectPluginReferences(
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
    }

    private createRuntimeArgumentDefinitions(
        context: WorkflowExecutionContext,
        persistedDefinitions: WorkflowArgumentDefinition[]
    ): WorkflowArgumentDefinition[] {
        const definitions: WorkflowArgumentDefinition[] = [];
        const selectedTimestepsArgument = WorkflowArgumentsHandler.RESERVED_RUNTIME_ARGUMENTS.selectedTimesteps;
        const hasReservedArgument = persistedDefinitions.some((definition) => {
            if (definition.argument === selectedTimestepsArgument) {
                return true;
            }

            return this.definitionTreeHasArgument(definition.listArguments, selectedTimestepsArgument);
        });

        if (!hasReservedArgument && context.runtimeArguments[selectedTimestepsArgument] !== undefined) {
            definitions.push({
                argument: selectedTimestepsArgument,
                type: 'list'
            });
        }

        return definitions;
    }

    private definitionTreeHasArgument(
        definitions: WorkflowArgumentDefinition[] | undefined,
        argumentKey: string
    ): boolean {
        if (!definitions) {
            return false;
        }

        return definitions.some((definition) => {
            if (definition.argument === argumentKey) {
                return true;
            }

            return this.definitionTreeHasArgument(definition.listArguments, argumentKey);
        });
    }
}
