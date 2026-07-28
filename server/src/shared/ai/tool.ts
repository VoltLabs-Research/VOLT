import type { z } from 'zod';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';

/**
 * Human-in-the-loop gate. `true` always asks the user to confirm before the
 * tool runs; a predicate decides per call from the model-supplied input.
 */
export type AIToolApproval<TInput> = boolean | ((input: TInput) => boolean | Promise<boolean>);

/** The three things a model needs to know about a tool, plus the optional approval gate. */
export interface AIToolMetadata<TSchema extends z.ZodType> {
    name: string;
    description: string;
    parameters: TSchema;
    needsApproval?: AIToolApproval<z.output<TSchema>>;
}

export interface AIToolDefinition {
    name: string;
    description: string;
    parameters: z.ZodType;
    handlerName: string | symbol;
    /** Advertised to the model but executed in the browser; the server contributes no behaviour. */
    clientExecuted: boolean;
    needsApproval?: AIToolApproval<never>;
}

/** A tool handler receives the parsed input merged with the caller's team/user scope. */
export type AIToolHandler<TSchema extends z.ZodType> = (input: z.output<TSchema> & AIToolScope) => unknown;

const toolsByController = new WeakMap<object, AIToolDefinition[]>();

const register = <TSchema extends z.ZodType>(
    controller: object,
    metadata: AIToolMetadata<TSchema>,
    handlerName: string | symbol,
    clientExecuted: boolean
): void => {
    const list = toolsByController.get(controller) ?? [];

    list.push({
        name: metadata.name,
        description: metadata.description,
        parameters: metadata.parameters,
        handlerName,
        clientExecuted,
        needsApproval: metadata.needsApproval as AIToolApproval<never> | undefined
    });

    toolsByController.set(controller, list);
};

/**
 * Declares a server-executed AI tool. The decorated method is the handler: it
 * receives the validated input already merged with the caller's scope, so it can
 * hand that single object straight to a service — exactly like an HTTP
 * controller action delegates to one.
 *
 * The generic constraint makes the method signature type-check against
 * `parameters`, so a schema change surfaces on the handler instead of at runtime.
 */
export const AITool = <TSchema extends z.ZodType>(metadata: AIToolMetadata<TSchema>) =>
    <THandler extends AIToolHandler<TSchema>>(
        target: object,
        handlerName: string | symbol,
        _descriptor: TypedPropertyDescriptor<THandler>
    ): void => {
        register(target.constructor, metadata, handlerName, false);
    };

/**
 * Declares a tool the client executes (viewer/UI actions). The server only
 * advertises name, description and schema, so the decorated method is a
 * declaration site with no body — it is never invoked server-side.
 */
export const ClientAITool = <TSchema extends z.ZodType>(metadata: AIToolMetadata<TSchema>): MethodDecorator =>
    (target, handlerName) => {
        register(target.constructor, metadata, handlerName, true);
    };

export const getAITools = (controller: object): AIToolDefinition[] => toolsByController.get(controller) ?? [];
