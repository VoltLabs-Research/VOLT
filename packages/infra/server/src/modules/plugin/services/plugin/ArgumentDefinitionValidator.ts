import { ArgumentType, NodeType, ArgumentVisibilityOperator } from '@volt/contracts/modules/plugin/enums';
import type {
    IArgumentDefinition,
    IArgumentVisibilityCondition,
    IWorkflow
} from '@volt/contracts/modules/plugin/workflow';

const ARGUMENT_VISIBILITY_OPERATORS = new Set<string>(Object.values(ArgumentVisibilityOperator));

export const readArgumentDefinitions = (workflow: IWorkflow): IArgumentDefinition[] => {
    const argumentsNode = workflow.nodes.find((node) => node.type === NodeType.ARGUMENTS);
    return Array.isArray(argumentsNode?.data.arguments?.arguments)
        ? argumentsNode.data.arguments.arguments
        : [];
};

export const containsPluginReferenceArgument = (definition: IArgumentDefinition): boolean => {
    if (definition.type === ArgumentType.PLUGIN_REFERENCE) {
        return true;
    }

    if (definition.type !== ArgumentType.LIST || !Array.isArray(definition.listArguments)) {
        return false;
    }

    return definition.listArguments.some((nestedDefinition) => containsPluginReferenceArgument(nestedDefinition));
};

const validateArgumentCondition = (
    condition: IArgumentVisibilityCondition,
    definitions: IArgumentDefinition[],
    scope: string,
    field: string,
    errors: string[],
    selfArgument?: string
): void => {
    const controllingArgument = condition.argument?.trim() || '';
    if (!controllingArgument) {
        errors.push(`${scope} ${field}.argument is required`);
    } else if (selfArgument !== undefined && controllingArgument === selfArgument) {
        errors.push(`${scope} cannot depend on itself`);
    } else if (!definitions.some((candidate) => candidate.argument === controllingArgument)) {
        errors.push(`${scope} references unknown ${field} argument "${controllingArgument}"`);
    }

    if (!ARGUMENT_VISIBILITY_OPERATORS.has(condition.operator)) {
        errors.push(`${scope} uses unsupported ${field} operator "${condition.operator}"`);
    }

    if (
        (condition.operator === 'equals' || condition.operator === 'notEquals')
        && condition.value === undefined
    ) {
        errors.push(`${scope} requires ${field}.value for operator "${condition.operator}"`);
    }

    if (
        (condition.operator === 'in' || condition.operator === 'notIn')
        && (!Array.isArray(condition.values) || condition.values.length === 0)
    ) {
        errors.push(`${scope} requires ${field}.values for operator "${condition.operator}"`);
    }
};

export const validateExposureExportConditions = (
    workflow: IWorkflow,
    errors: string[]
): void => {
    const definitions = readArgumentDefinitions(workflow);

    for (const node of workflow.nodes) {
        if (node.type !== NodeType.EXPOSURE) {
            continue;
        }

        const exportWhen = node.data.exposure?.exportWhen;
        if (!exportWhen) {
            continue;
        }

        validateArgumentCondition(exportWhen, definitions, `exposure ${node.id}`, 'exportWhen', errors);
    }
};

const validateVisibilityCondition = (
    definition: IArgumentDefinition,
    definitions: IArgumentDefinition[],
    argumentScope: string,
    errors: string[]
): void => {
    const visibleWhen = definition.visibleWhen;
    if (!visibleWhen) {
        return;
    }

    validateArgumentCondition(
        visibleWhen,
        definitions,
        argumentScope,
        'visibleWhen',
        errors,
        definition.argument
    );
};

const validatePluginReferenceMappings = (
    definition: IArgumentDefinition,
    definitions: IArgumentDefinition[],
    argumentScope: string,
    errors: string[]
): void => {
    if (definition.type !== ArgumentType.PLUGIN_REFERENCE || definition.pluginReferenceMappings === undefined) {
        return;
    }

    if (!Array.isArray(definition.pluginReferenceMappings)) {
        errors.push(`${argumentScope} pluginReferenceMappings must be an array`);
        return;
    }

    definition.pluginReferenceMappings.forEach((mapping, mappingIndex) => {
        const mappingScope = `${argumentScope}.pluginReferenceMappings[${mappingIndex}]`;
        const sourceArgument = typeof mapping.sourceArgument === 'string'
            ? mapping.sourceArgument.trim()
            : '';
        const targetArgument = typeof mapping.targetArgument === 'string'
            ? mapping.targetArgument.trim()
            : '';
        if (!sourceArgument) {
            errors.push(`${mappingScope} sourceArgument is required`);
        } else if (!definitions.some((candidate) => candidate.argument === sourceArgument)) {
            errors.push(`${mappingScope} references unknown source argument "${sourceArgument}"`);
        }

        if (!targetArgument) {
            errors.push(`${mappingScope} targetArgument is required`);
        }

        if (mapping.valueMap !== undefined && (typeof mapping.valueMap !== 'object' || mapping.valueMap === null || Array.isArray(mapping.valueMap))) {
            errors.push(`${mappingScope} valueMap must be an object`);
        }
    });
};

const validateOptionSources = (
    definition: IArgumentDefinition,
    definitions: IArgumentDefinition[],
    rootDefinitions: IArgumentDefinition[],
    argumentScope: string,
    errors: string[]
): void => {
    if (definition.optionsFromArguments !== undefined) {
        if (!Array.isArray(definition.optionsFromArguments)) {
            errors.push(`${argumentScope} optionsFromArguments must be an array`);
        } else if (definition.optionsFromArguments.length > 0) {
            if (definition.type !== ArgumentType.SELECT) {
                errors.push(`${argumentScope} optionsFromArguments can only be used with select arguments`);
            } else {
                definition.optionsFromArguments.forEach((source, sourceIndex) => {
                    const sourceScope = `${argumentScope}.optionsFromArguments[${sourceIndex}]`;
                    const sourceArgument = source?.argument?.trim() ?? '';

                    if (!sourceArgument) {
                        errors.push(`${sourceScope} argument is required`);
                        return;
                    }

                    const sourceExists = definitions.some((candidate) => candidate.argument === sourceArgument)
                        || rootDefinitions.some((candidate) => candidate.argument === sourceArgument);
                    if (!sourceExists) {
                        errors.push(`${sourceScope} references unknown argument "${sourceArgument}"`);
                    }
                });
            }
        }
    }

    if (definition.optionsFromPluginReference === undefined) {
        return;
    }

    const referenceArgument = definition.optionsFromPluginReference.trim();
    if (definition.type !== ArgumentType.SELECT) {
        errors.push(`${argumentScope} optionsFromPluginReference can only be used with select arguments`);
    } else if (!referenceArgument) {
        errors.push(`${argumentScope} optionsFromPluginReference cannot be empty`);
    } else {
        const referenced = definitions.find((candidate) => candidate.argument === referenceArgument)
            ?? rootDefinitions.find((candidate) => candidate.argument === referenceArgument);
        if (!referenced) {
            errors.push(`${argumentScope} optionsFromPluginReference references unknown argument "${referenceArgument}"`);
        } else if (referenced.type !== ArgumentType.PLUGIN_REFERENCE) {
            errors.push(`${argumentScope} optionsFromPluginReference must reference a pluginReference argument`);
        }
    }
};

export const validateArgumentDefinitions = (
    definitions: IArgumentDefinition[],
    errors: string[],
    scope = 'arguments',
    rootDefinitions: IArgumentDefinition[] = definitions
): void => {
    for (const definition of definitions) {
        const argumentKey = definition.argument?.trim() || '<unnamed>';
        const argumentScope = `${scope}.${argumentKey}`;

        validateVisibilityCondition(definition, definitions, argumentScope, errors);
        validatePluginReferenceMappings(definition, definitions, argumentScope, errors);
        validateOptionSources(definition, definitions, rootDefinitions, argumentScope, errors);

        if (definition.type === ArgumentType.LIST && definition.listItemLabelArgument !== undefined) {
            const listItemLabelArgument = definition.listItemLabelArgument.trim();
            if (!listItemLabelArgument) {
                errors.push(`${argumentScope} listItemLabelArgument cannot be empty`);
            } else if (!(definition.listArguments ?? []).some((candidate) => candidate.argument === listItemLabelArgument)) {
                errors.push(`${argumentScope} listItemLabelArgument references unknown nested argument "${listItemLabelArgument}"`);
            }
        }

        if (definition.listArguments?.length) {
            validateArgumentDefinitions(definition.listArguments, errors, argumentScope, rootDefinitions);
        }
    }
};
