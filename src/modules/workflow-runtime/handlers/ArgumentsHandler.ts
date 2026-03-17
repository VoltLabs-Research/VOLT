import type { WorkflowExecutionContext, WorkflowNode } from '../contracts';
import type { WorkflowNodeHandler, WorkflowNodeRegistry } from '../services';
import { encodeCliArgumentsToken, stringifyUnknown } from '@/shared/utils';
import { WorkflowNodeType } from '../contracts';

interface ArgumentDefinition {
    argument?: string;
    type?: string;
    value?: unknown;
    default?: unknown;
    listArguments?: ArgumentDefinition[];
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
        const persistedDefinitions = Array.isArray(nodeData.arguments?.arguments)
            ? nodeData.arguments.arguments
            : [];
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
                value = this.registry.resolveTemplate(value, context);
            }

            values[argumentKey] = value;
            if (value !== null && value !== undefined) {
                if (definition.type === 'boolean') {
                    if (String(value) === 'true') {
                        cliArgs.push(`--${argumentKey}`);
                    }
                } else {
                    const serializedValue = stringifyUnknown(value);
                    cliArgs.push(`--${argumentKey}`, serializedValue);
                }
            }
        }

        return {
            as_str: encodeCliArgumentsToken(cliArgs),
            as_array: cliArgs,
            ...values
        };
    }
}
