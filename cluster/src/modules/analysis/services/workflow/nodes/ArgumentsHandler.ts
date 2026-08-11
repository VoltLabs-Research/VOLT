import type { WorkflowArgumentDefinition } from '@shared/contracts/types/http-workflow';
import type {
    WorkflowExecutionContext,
    WorkflowNode,
    WorkflowNodeOutput,
    WorkflowValue
} from '@shared/contracts/types/workflow.types';
import type { WorkflowNodeHandler, WorkflowNodeRegistry } from '@modules/analysis/services/workflow/NodeRegistry';
import { WorkflowValueResolver } from '@modules/analysis/services/workflow/WorkflowValueResolver';
import { isArgumentVisible } from '@modules/analysis/services/workflow/nodes/argument-visibility';
import {
    applyPluginReferenceMappings,
    collectPluginReferences,
    readPluginReferenceSelections
} from '@modules/analysis/services/workflow/nodes/plugin-reference-arguments';
import { encodeCliArgumentsToken, stringifyWorkflowValue } from '@shared/application/utilities/serialization';
import { WorkflowNodeType } from '@shared/contracts/types/workflow.types';

const SELECTED_TIMESTEPS_ARGUMENT = 'selectedTimesteps';

const definitionTreeHasArgument = (
    definitions: WorkflowArgumentDefinition[],
    argumentKey: string
): boolean => definitions.some((definition) => (
    definition.argument === argumentKey
    || definitionTreeHasArgument(definition.listArguments ?? [], argumentKey)
));

/** `required` is declared by the plugin manifest, so this is domain validation. */
const isRequiredValueMissing = (
    definition: WorkflowArgumentDefinition,
    value: WorkflowValue
): boolean => {
    if (definition.type === 'pluginReference') {
        return readPluginReferenceSelections(value).length === 0;
    }

    if (Array.isArray(value)) {
        return value.length === 0;
    }

    return value === undefined || value === null || value === '';
};

const createCliArgument = (
    definition: WorkflowArgumentDefinition,
    argumentKey: string,
    value: WorkflowValue
): string[] => {
    if (value === null || value === undefined || definition.type === 'pluginReference') {
        return [];
    }

    if (definition.type === 'boolean') {
        return value === true || value === 'true' ? [`--${argumentKey}`] : [];
    }

    if (definition.type === 'select' && definition.multipleSelection) {
        const selectedValues = Array.isArray(value) ? value : [value];
        return selectedValues.length > 0 ? [`--${argumentKey}`, selectedValues.join(',')] : [];
    }

    return [`--${argumentKey}`, stringifyWorkflowValue(value)];
};

export class WorkflowArgumentsHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.Arguments;

    constructor(private readonly registry: WorkflowNodeRegistry) {}

    async execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<WorkflowNodeOutput> {
        const definitions = this.buildArgumentDefinitions(node, context);
        const values = await this.resolveArgumentValues(definitions, node.id, context);
        applyPluginReferenceMappings(definitions, values, context.nestedWorkflows);
        this.assertRequiredVisibleArguments(definitions, values);

        const cliArgs = this.buildCliArgs(definitions, values);
        const pluginReferences = collectPluginReferences(definitions, values);

        return {
            as_str: encodeCliArgumentsToken(cliArgs),
            as_array: cliArgs,
            pluginReferences: {
                items: pluginReferences,
                str_json: JSON.stringify(pluginReferences)
            },
            ...this.getVisibleValues(definitions, values)
        };
    }

    private buildArgumentDefinitions(
        node: WorkflowNode,
        context: WorkflowExecutionContext
    ): WorkflowArgumentDefinition[] {
        const definitions = node.data.arguments?.arguments ?? [];
        const needsReservedTimesteps = context.runtimeArguments[SELECTED_TIMESTEPS_ARGUMENT] !== undefined
            && !definitionTreeHasArgument(definitions, SELECTED_TIMESTEPS_ARGUMENT);

        return needsReservedTimesteps
            ? [...definitions, {
 argument: SELECTED_TIMESTEPS_ARGUMENT, type: 'list' 
}]
            : definitions;
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

            const value = this.readConfiguredArgumentValue(definition, argumentKey, context);
            values[argumentKey] = WorkflowValueResolver.shouldResolveExpression(value)
                ? await this.registry.createValueResolver(context, nodeId).resolveExpressionValue(value)
                : value;
        }

        return values;
    }

    private readConfiguredArgumentValue(
        definition: WorkflowArgumentDefinition,
        argumentKey: string,
        context: WorkflowExecutionContext
    ): WorkflowValue {
        if (definition.value !== undefined) {
            return definition.value;
        }

        if (context.userConfig[argumentKey] !== undefined) {
            return context.userConfig[argumentKey];
        }

        if (context.runtimeArguments[argumentKey] !== undefined) {
            return context.runtimeArguments[argumentKey];
        }

        return definition.default;
    }

    private assertRequiredVisibleArguments(
        definitions: WorkflowArgumentDefinition[],
        values: WorkflowNodeOutput
    ): void {
        for (const definition of definitions) {
            const argumentKey = definition.argument;
            if (definition.required !== true || !argumentKey) {
                continue;
            }

            if (isArgumentVisible(definition, definitions, values)
                && isRequiredValueMissing(definition, values[argumentKey])) {
                throw new Error(`Required argument "${argumentKey}" is missing`);
            }
        }
    }

    private buildCliArgs(
        definitions: WorkflowArgumentDefinition[],
        values: WorkflowNodeOutput
    ): string[] {
        return definitions.flatMap((definition) => {
            const argumentKey = definition.argument;
            if (!argumentKey || !isArgumentVisible(definition, definitions, values)) {
                return [];
            }

            return createCliArgument(definition, argumentKey, values[argumentKey]);
        });
    }

    private getVisibleValues(
        definitions: WorkflowArgumentDefinition[],
        values: WorkflowNodeOutput
    ): WorkflowNodeOutput {
        return Object.fromEntries(definitions.flatMap((definition) => (
            definition.argument && isArgumentVisible(definition, definitions, values)
                ? [[definition.argument, values[definition.argument]]]
                : []
        )));
    }
}
