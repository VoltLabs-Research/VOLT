import type { IValidation } from 'typia';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';

/**
 * Human-in-the-loop gate. `true` always asks the user to confirm before the
 * tool runs; a predicate decides per call from the model-supplied input.
 */
type AIToolApproval<TInput> = boolean | ((input: TInput) => boolean | Promise<boolean>);

/**
 * JSON Schema for a tool's keyword arguments. Always produced by
 * `typia.llm.parameters<TInput>()`, so the TypeScript type is the only source
 * of truth — there is no schema DSL to keep in sync.
 */
interface AIToolParameters {
    type: 'object';
    properties: Record<string, unknown>;
    required?: readonly string[];
    additionalProperties?: boolean;
    $defs?: Record<string, unknown>;
}

/** Produced by `typia.createValidate<TInput>()`; rejects malformed model output. */
type AIToolValidator<TInput> = (input: unknown) => IValidation<TInput>;

/** The three things a model needs to know about a tool, plus the optional approval gate. */
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
    /** Advertised to the model but executed in the browser; the server contributes no behaviour. */
    clientExecuted: boolean;
    needsApproval?: AIToolApproval<never>;
}

/** A tool handler receives the validated input merged with the caller's team/user scope. */
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

/**
 * Declares a server-executed AI tool. The decorated method is the handler: it
 * receives the validated input already merged with the caller's scope, so it can
 * hand that single object straight to a service — exactly like an HTTP
 * controller action delegates to one.
 *
 * `TInput` is inferred from `validate`, so the handler signature type-checks
 * against the same type the schema was generated from.
 */
export const AITool = <TInput>(metadata: AIToolMetadata<TInput>) =>
    <THandler extends AIToolHandler<TInput>>(
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
export const ClientAITool = <TInput>(metadata: AIToolMetadata<TInput>): MethodDecorator =>
    (target, handlerName) => {
        register(target.constructor, metadata, handlerName, true);
    };

export const getAITools = (controller: object): AIToolDefinition[] => toolsByController.get(controller) ?? [];
