import type { IValidation } from 'typia';
import type { TeamArea } from '@volt/contracts/modules/team/access';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';

export enum AIToolAccess {
    Read = 'read',
    Write = 'write'
}

export enum AIToolRunner {
    Server = 'server',
    Browser = 'browser'
}

export type AIToolApproval<TInput> = boolean | ((input: TInput) => boolean);

export interface AIToolParameters {
    type: 'object';
    properties: Record<string, unknown>;
    required?: readonly string[];
    additionalProperties?: boolean;
    $defs?: Record<string, unknown>;
}

export type AIToolValidator<TInput> = (input: unknown) => IValidation<TInput>;

interface AIToolMetadata<TInput> {
    name: string;
    description: string;
    parameters: AIToolParameters;
    validate: AIToolValidator<TInput>;
    access: AIToolAccess;
    // The team area its HTTP twin guards, or null when it touches only the caller's own account or
    // screen. With access it picks the lowest role offered the tool; others never see it.
    area: TeamArea | null;
    // Writes ask the user first unless this says otherwise.
    approval?: AIToolApproval<TInput>;
}

export interface AIToolDefinition {
    name: string;
    description: string;
    parameters: AIToolParameters;
    validate: AIToolValidator<unknown>;
    access: AIToolAccess;
    area: TeamArea | null;
    approval: AIToolApproval<unknown>;
    runner: AIToolRunner;
    handlerName: string | symbol;
}

type AIToolHandler<TInput> = (input: TInput & AIToolScope) => unknown;

const toolsByController = new WeakMap<object, AIToolDefinition[]>();

const register = <TInput>(
    controller: object,
    metadata: AIToolMetadata<TInput>,
    handlerName: string | symbol,
    runner: AIToolRunner
): void => {
    const list = toolsByController.get(controller) ?? [];

    list.push({
        name: metadata.name,
        description: metadata.description,
        parameters: metadata.parameters,
        validate: metadata.validate as AIToolValidator<unknown>,
        access: metadata.access,
        area: metadata.area,
        approval: (metadata.approval ?? metadata.access === AIToolAccess.Write) as AIToolApproval<unknown>,
        runner,
        handlerName
    });

    toolsByController.set(controller, list);
};

export const AITool = <TInput>(metadata: AIToolMetadata<TInput>) =>
    <THandler extends AIToolHandler<TInput>>(
        target: object,
        handlerName: string | symbol,
        _descriptor: TypedPropertyDescriptor<THandler>
    ): void => {
        register(target.constructor, metadata, handlerName, AIToolRunner.Server);
    };

// Runs in the tab that drives the conversation: the server forwards the call over the socket.
export const BrowserAITool = <TInput>(metadata: AIToolMetadata<TInput>): MethodDecorator =>
    (target, handlerName) => {
        register(target.constructor, metadata, handlerName, AIToolRunner.Browser);
    };

export const getAITools = (controller: object): AIToolDefinition[] => toolsByController.get(controller) ?? [];
