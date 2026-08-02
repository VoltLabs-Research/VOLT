import type { WorkflowProps } from '@modules/plugin/models/plugin/workflow/Workflow';
import {
    ArgumentType,
    ArgumentVisibilityOperators,
    WorkflowNodeType,
    type ArgumentDefinition
} from '@modules/plugin/models/plugin/workflow/WorkflowTypes';

export const readArgumentDefinitions = (workflow: WorkflowProps): ArgumentDefinition[] => {
    const argumentsNode = workflow.nodes.find((node) => node.type === WorkflowNodeType.Arguments);
    return Array.isArray(argumentsNode?.data.arguments?.arguments)
        ? argumentsNode.data.arguments.arguments
        : [];
};

export const containsPluginReferenceArgument = (definition: ArgumentDefinition): boolean => {
    if (definition.type === ArgumentType.PLUGIN_REFERENCE) {
        return true;
    }

    if (definition.type !== ArgumentType.LIST || !Array.isArray(definition.listArguments)) {
        return false;
    }

    return definition.listArguments.some((nestedDefinition) => containsPluginReferenceArgument(nestedDefinition));
};

const validateVisibilityCondition = (
    definition: ArgumentDefinition,
    definitions: ArgumentDefinition[],
    argumentScope: string,
    errors: string[]
): void => {
    const visibleWhen = definition.visibleWhen;
    if (!visibleWhen) {
        return;
    }

    const controllingArgument = visibleWhen.argument?.trim() || '';
    if (!controllingArgument) {
        errors.push(`${argumentScope} visibleWhen.argument is required`);
    } else if (controllingArgument === definition.argument) {
        errors.push(`${argumentScope} cannot depend on itself`);
    } else if (!definitions.some((candidate) => candidate.argument === controllingArgument)) {
        errors.push(`${argumentScope} references unknown visibility argument "${controllingArgument}"`);
    }

    if (!ArgumentVisibilityOperators.includes(visibleWhen.operator)) {
        errors.push(`${argumentScope} uses unsupported visibility operator "${visibleWhen.operator}"`);
    }

    if (
        (visibleWhen.operator === 'equals' || visibleWhen.operator === 'notEquals')
        && visibleWhen.value === undefined
    ) {
        errors.push(`${argumentScope} requires visibleWhen.value for operator "${visibleWhen.operator}"`);
    }

    if (
        (visibleWhen.operator === 'in' || visibleWhen.operator === 'notIn')
        && (!Array.isArray(visibleWhen.values) || visibleWhen.values.length === 0)
    ) {
        errors.push(`${argumentScope} requires visibleWhen.values for operator "${visibleWhen.operator}"`);
    }
};

const validatePluginReferenceMappings = (
    definition: ArgumentDefinition,
    definitions: ArgumentDefinition[],
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
    definition: ArgumentDefinition,
    definitions: ArgumentDefinition[],
    rootDefinitions: ArgumentDefinition[],
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
    definitions: ArgumentDefinition[],
    errors: string[],
    scope = 'arguments',
    rootDefinitions: ArgumentDefinition[] = definitions
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
