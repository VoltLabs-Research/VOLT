import type {
    WorkflowArgumentDefinition,
    WorkflowArgumentVisibilityCondition,
    WorkflowDefinition,
    WorkflowPluginReferenceArgumentMapping
} from '@/contracts';
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

const isPluginReferenceSelectionRecord = (value: unknown): value is {
    pluginId: string;
    config?: unknown;
} => {
    return typeof value === 'object'
        && value !== null
        && !Array.isArray(value)
        && typeof (value as { pluginId?: unknown }).pluginId === 'string';
};

const isWorkflowNodeOutputRecord = (value: unknown): value is WorkflowNodeOutput => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const readPluginReferenceSelections = (
    value: unknown
): WorkflowPluginReferenceValueWithSelections['selections'] => {
    const selections = (typeof value === 'object' && value !== null && !Array.isArray(value))
        ? (value as { selections?: unknown }).selections
        : undefined;

    if (!Array.isArray(selections)) {
        return [];
    }

    return selections.flatMap((selection) => {
        if (!isPluginReferenceSelectionRecord(selection)) {
            return [];
        }

        const pluginId = selection.pluginId.trim();
        if (!pluginId) {
            return [];
        }

        return [{
            pluginId,
            config: isWorkflowNodeOutputRecord(selection.config) ? selection.config : {}
        }];
    });
};

const normalizePluginReferenceValue = (value: unknown): WorkflowPluginReferenceValueWithSelections => {
    return {
        selections: readPluginReferenceSelections(value)
    };
};

const normalizePluginReferenceMappings = (
    mappings: WorkflowPluginReferenceArgumentMapping[] | undefined
): WorkflowPluginReferenceArgumentMapping[] => {
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
            ...(isWorkflowNodeOutputRecord(mapping.valueMap) ? { valueMap: mapping.valueMap } : {})
        }];
    });
};

const getWorkflowModifierKey = (workflow: WorkflowDefinition | undefined): string => {
    const modifierNode = workflow?.nodes.find((node) => node.type === WorkflowNodeType.Modifier);
    const modifierKey = modifierNode?.data.modifier?.key;
    return typeof modifierKey === 'string' ? modifierKey.trim() : '';
};

const resolveMappingSourceValue = (
    mapping: WorkflowPluginReferenceArgumentMapping,
    definitions: WorkflowArgumentDefinition[],
    values: WorkflowNodeOutput
): WorkflowNodeOutput[string] => {
    const sourceDefinition = definitions.find((definition) => definition.argument === mapping.sourceArgument);
    const value = values[mapping.sourceArgument ?? ''] !== undefined
        ? values[mapping.sourceArgument ?? '']
        : sourceDefinition?.value !== undefined
            ? sourceDefinition.value as WorkflowNodeOutput[string]
            : sourceDefinition?.default as WorkflowNodeOutput[string] | undefined;

    if (!isWorkflowNodeOutputRecord(mapping.valueMap)) {
        return value;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        const valueMapKey = String(value);
        if (Object.prototype.hasOwnProperty.call(mapping.valueMap, valueMapKey)) {
            return mapping.valueMap[valueMapKey];
        }
    }

    return value;
};

const applyPluginReferenceMappings = (
    definition: WorkflowArgumentDefinition,
    value: WorkflowNodeOutput[string],
    definitions: WorkflowArgumentDefinition[],
    values: WorkflowNodeOutput,
    nestedWorkflows: Map<string, WorkflowDefinition>
): WorkflowPluginReferenceValueWithSelections => {
    const pluginReferenceValue = normalizePluginReferenceValue(value);
    const mappings = normalizePluginReferenceMappings(definition.pluginReferenceMappings);
    if (mappings.length === 0) {
        return pluginReferenceValue;
    }

    return {
        selections: pluginReferenceValue.selections.map((selection) => {
            const pluginKey = getWorkflowModifierKey(nestedWorkflows.get(selection.pluginId));
            const config = { ...(selection.config ?? {}) };

            for (const mapping of mappings) {
                if (mapping.targetPluginId && mapping.targetPluginId !== selection.pluginId) {
                    continue;
                }

                if (mapping.targetPluginKey && mapping.targetPluginKey !== pluginKey) {
                    continue;
                }

                const mappedValue = resolveMappingSourceValue(mapping, definitions, values);
                if (mappedValue === undefined) {
                    continue;
                }

                config[mapping.targetArgument as string] = mappedValue;
            }

            return {
                pluginId: selection.pluginId,
                config
            };
        })
    };
};

const isRequiredValueMissing = (
    definition: WorkflowArgumentDefinition,
    value: WorkflowNodeOutput[string]
): boolean => {
    if (definition.type === 'pluginReference') {
        return readPluginReferenceSelections(value).length === 0;
    }

    if (Array.isArray(value)) {
        return value.length === 0;
    }

    return value === undefined || value === null || value === '';
};

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

            if (definition.type === 'pluginReference') {
                value = normalizePluginReferenceValue(value) as unknown as WorkflowNodeOutput[string];
            }

            values[argumentKey] = value as WorkflowNodeOutput[string];
        }

        for (const definition of definitions) {
            const argumentKey = definition.argument;
            if (!argumentKey || definition.type !== 'pluginReference') {
                continue;
            }

            values[argumentKey] = applyPluginReferenceMappings(
                definition,
                values[argumentKey],
                definitions,
                values,
                context.nestedWorkflows
            ) as unknown as WorkflowNodeOutput[string];
        }

        for (const definition of definitions) {
            const argumentKey = definition.argument;
            if (!argumentKey || !this.isArgumentVisible(definition, definitions, values)) {
                continue;
            }

            if (definition.required === true && isRequiredValueMissing(definition, values[argumentKey])) {
                throw new Error(`Required argument "${argumentKey}" is missing`);
            }
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
            for (const selection of readPluginReferenceSelections(resolvedValue)) {
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
