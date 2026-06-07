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

type WorkflowArgumentValue = WorkflowNodeOutput[string];

const isWorkflowNodeOutputRecord = (value: unknown): value is WorkflowNodeOutput => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const readPluginReferenceSelections = (
    value: unknown
): WorkflowPluginReferenceValueWithSelections['selections'] => {
    const selections = isWorkflowNodeOutputRecord(value)
        ? (value as { selections?: unknown }).selections
        : undefined;

    if (!Array.isArray(selections)) {
        return [];
    }

    return selections.flatMap((selection) => {
        const candidate = selection as { pluginId?: unknown; config?: unknown };
        const pluginId = typeof candidate.pluginId === 'string' ? candidate.pluginId.trim() : '';
        if (!pluginId) {
            return [];
        }

        return [{
            pluginId,
            config: isWorkflowNodeOutputRecord(candidate.config) ? candidate.config : {}
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
        const sourceArgument = mapping.sourceArgument?.trim() ?? '';
        const targetArgument = mapping.targetArgument?.trim() ?? '';

        if (!sourceArgument || !targetArgument) {
            return [];
        }

        const targetPluginId = mapping.targetPluginId?.trim() ?? '';
        const targetPluginKey = mapping.targetPluginKey?.trim() ?? '';

        return [{
            sourceArgument,
            targetArgument,
            ...(targetPluginId ? { targetPluginId } : {}),
            ...(targetPluginKey ? { targetPluginKey } : {}),
            ...(mapping.valueMap ? { valueMap: mapping.valueMap } : {})
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
    const sourceKey = mapping.sourceArgument ?? '';
    let value: WorkflowNodeOutput[string] | undefined;
    if (values[sourceKey] !== undefined) {
        value = values[sourceKey];
    } else if (sourceDefinition?.value !== undefined) {
        value = sourceDefinition.value as WorkflowNodeOutput[string];
    } else {
        value = sourceDefinition?.default as WorkflowNodeOutput[string] | undefined;
    }

    const valueMap = mapping.valueMap;
    if (!valueMap) {
        return value;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        const valueMapKey = String(value);
        if (Object.prototype.hasOwnProperty.call(valueMap, valueMapKey)) {
            return valueMap[valueMapKey];
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
        const definitions = this.buildArgumentDefinitions(node, context);
        const values = await this.resolveArgumentValues(definitions, node.id, context);
        this.applyPluginReferenceMappingsToValues(definitions, values, context);
        this.assertRequiredVisibleArguments(definitions, values);

        const cliArgs = this.buildCliArgs(definitions, values);
        const pluginReferences = this.collectVisiblePluginReferences(definitions, values);
        const visibleValues = this.getVisibleValues(definitions, values);

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

    private buildArgumentDefinitions(
        node: WorkflowNode,
        context: WorkflowExecutionContext
    ): WorkflowArgumentDefinition[] {
        const persistedDefinitions = node.data.arguments?.arguments ?? [];
        return [
            ...persistedDefinitions,
            ...this.createRuntimeArgumentDefinitions(context, persistedDefinitions)
        ];
    }

    private async resolveArgumentValues(
        definitions: WorkflowArgumentDefinition[],
        nodeId: string,
        context: WorkflowExecutionContext
    ): Promise<WorkflowNodeOutput> {
        const values: WorkflowNodeOutput = {};

        for (const definition of definitions) {
            const argumentKey = definition.argument;
            if (!argumentKey) {
                continue;
            }

            values[argumentKey] = await this.resolveArgumentValue(definition, argumentKey, nodeId, context);
        }

        return values;
    }

    private async resolveArgumentValue(
        definition: WorkflowArgumentDefinition,
        argumentKey: string,
        nodeId: string,
        context: WorkflowExecutionContext
    ): Promise<WorkflowArgumentValue> {
        let value = this.readConfiguredArgumentValue(definition, argumentKey, context);

        if (this.registry.shouldResolveExpression(value)) {
            value = await this.registry.resolveExpressionValue(value, context, nodeId);
        }

        if (definition.type === 'pluginReference') {
            return normalizePluginReferenceValue(value) as unknown as WorkflowArgumentValue;
        }

        return value as WorkflowArgumentValue;
    }

    private readConfiguredArgumentValue(
        definition: WorkflowArgumentDefinition,
        argumentKey: string,
        context: WorkflowExecutionContext
    ): WorkflowArgumentValue | undefined {
        if (definition.value !== undefined) {
            return definition.value as WorkflowArgumentValue;
        }

        if (context.userConfig[argumentKey] !== undefined) {
            return context.userConfig[argumentKey] as WorkflowArgumentValue;
        }

        if (context.runtimeArguments[argumentKey] !== undefined) {
            return context.runtimeArguments[argumentKey] as WorkflowArgumentValue;
        }

        return definition.default as WorkflowArgumentValue | undefined;
    }

    private applyPluginReferenceMappingsToValues(
        definitions: WorkflowArgumentDefinition[],
        values: WorkflowNodeOutput,
        context: WorkflowExecutionContext
    ): void {
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
            ) as unknown as WorkflowArgumentValue;
        }
    }

    private assertRequiredVisibleArguments(
        definitions: WorkflowArgumentDefinition[],
        values: WorkflowNodeOutput
    ): void {
        for (const definition of definitions) {
            const argumentKey = definition.argument;
            if (!argumentKey || !this.isArgumentVisible(definition, definitions, values)) {
                continue;
            }

            if (definition.required === true && isRequiredValueMissing(definition, values[argumentKey])) {
                throw new Error(`Required argument "${argumentKey}" is missing`);
            }
        }
    }

    private buildCliArgs(
        definitions: WorkflowArgumentDefinition[],
        values: WorkflowNodeOutput
    ): string[] {
        const cliArgs: string[] = [];

        for (const definition of definitions) {
            const argumentKey = definition.argument;
            if (!argumentKey || !this.isArgumentVisible(definition, definitions, values)) {
                continue;
            }

            this.appendCliArgument(cliArgs, definition, argumentKey, values[argumentKey]);
        }

        return cliArgs;
    }

    private appendCliArgument(
        cliArgs: string[],
        definition: WorkflowArgumentDefinition,
        argumentKey: string,
        value: WorkflowArgumentValue
    ): void {
        if (value === null || value === undefined || definition.type === 'pluginReference') {
            return;
        }

        if (definition.type === 'boolean') {
            if (value === true || value === 'true') {
                cliArgs.push(`--${argumentKey}`);
            }
            return;
        }

        if (definition.type === 'select' && definition.multipleSelection) {
            const selectedValues = value instanceof Array ? value : [value];
            if (selectedValues.length > 0) {
                cliArgs.push(`--${argumentKey}`, selectedValues.join(','));
            }
            return;
        }

        const serializedValue = stringifyUnknown(value as Parameters<typeof stringifyUnknown>[0]);
        cliArgs.push(`--${argumentKey}`, serializedValue);
    }

    private collectVisiblePluginReferences(
        definitions: WorkflowArgumentDefinition[],
        values: WorkflowNodeOutput
    ): PluginReferencePlanningItem[] {
        const pluginReferences: PluginReferencePlanningItem[] = [];

        for (const definition of definitions) {
            const argumentKey = definition.argument;
            if (!argumentKey) {
                continue;
            }

            this.collectPluginReferences(definitions, definition, values[argumentKey], values, argumentKey, pluginReferences);
        }

        return pluginReferences;
    }

    private getVisibleValues(
        definitions: WorkflowArgumentDefinition[],
        values: WorkflowNodeOutput
    ): WorkflowNodeOutput {
        return Object.fromEntries(definitions
            .filter((definition) => definition.argument && this.isArgumentVisible(definition, definitions, values))
            .map((definition) => [definition.argument as string, values[definition.argument as string]])
        );
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
        let currentValue: unknown;
        if (referencedDefinition?.value !== undefined) {
            currentValue = referencedDefinition.value;
        } else if (values[definition.visibleWhen.argument] !== undefined) {
            currentValue = values[definition.visibleWhen.argument];
        } else {
            currentValue = referencedDefinition?.default;
        }

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

        let resolvedValue: unknown;
        if (value !== undefined) {
            resolvedValue = value;
        } else if (definition.value !== undefined) {
            resolvedValue = definition.value;
        } else {
            resolvedValue = definition.default;
        }

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
            const nestedDefinitions = definition.listArguments ?? [];
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
