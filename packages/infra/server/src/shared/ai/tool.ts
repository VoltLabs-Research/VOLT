import type { IValidation } from 'typia';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';

type AIToolApproval<TInput> = boolean | ((input: TInput) => boolean | Promise<boolean>);

interface AIToolParameters {
    type: 'object';
    properties: Record<string, unknown>;
    required?: readonly string[];
    additionalProperties?: boolean;
    $defs?: Record<string, unknown>;
}

type AIToolValidator<TInput> = (input: unknown) => IValidation<TInput>;

interface AIToolMetadata<TInput> {
    name: string;
    description: string;
    parameters: AIToolParameters;
    validate: AIToolValidator<TInput>;
    needsApproval?: AIToolApproval<TInput>;
}

export interface AIToolDefinition {
    name: string;
    description: string;
    parameters: AIToolParameters;
    validate: AIToolValidator<unknown>;
    handlerName: string | symbol;
    clientExecuted: boolean;
    needsApproval?: AIToolApproval<never>;
}

type AIToolHandler<TInput> = (input: TInput & AIToolScope) => unknown;

const toolsByController = new WeakMap<object, AIToolDefinition[]>();

const register = <TInput>(
    controller: object,
    metadata: AIToolMetadata<TInput>,
    handlerName: string | symbol,
    clientExecuted: boolean
): void => {
    const list = toolsByController.get(controller) ?? [];

    list.push({
        name: metadata.name,
        description: metadata.description,
        parameters: metadata.parameters,
        validate: metadata.validate as AIToolValidator<unknown>,
        handlerName,
        clientExecuted,
        needsApproval: metadata.needsApproval as AIToolApproval<never> | undefined
    });

    toolsByController.set(controller, list);
};

export const AITool = <TInput>(metadata: AIToolMetadata<TInput>) =>
    <THandler extends AIToolHandler<TInput>>(
        target: object,
        handlerName: string | symbol,
        _descriptor: TypedPropertyDescriptor<THandler>
    ): void => {
        register(target.constructor, metadata, handlerName, false);
    };

export const ClientAITool = <TInput>(metadata: AIToolMetadata<TInput>): MethodDecorator =>
    (target, handlerName) => {
        register(target.constructor, metadata, handlerName, true);
    };

export const getAITools = (controller: object): AIToolDefinition[] => toolsByController.get(controller) ?? [];
