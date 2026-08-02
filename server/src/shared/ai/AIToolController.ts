import { jsonSchema, tool } from 'ai';
import type { Tool, ToolSet } from 'ai';
import type { IValidation } from 'typia';
import { getAITools } from '@shared/ai/tool';
import type { AIToolDefinition } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';

type ToolHandler = (input: Record<string, unknown>) => unknown;

type ValidationResult = { success: true; value: unknown } | { success: false; error: Error };

/** Turns typia's failure report into the single Error the AI SDK feeds back to the model. */
const messageOf = (errors: IValidation.IError[]): string => {
    const details = errors
        .slice(0, 5)
        .map((error) => `${error.path.replace(/^\$input\.?/, '') || 'input'} expected ${error.expected}`)
        .join('; ');

    return `Invalid tool input: ${details}${errors.length > 5 ? ` (+${errors.length - 5} more)` : ''}`;
};

/**
 * Base class for a module's AI tool surface. Subclasses declare one decorated
 * method per tool — the AI-facing sibling of `shared/http/Controller`, which
 * turns `@Route` methods into an Express router.
 */
export default abstract class AIToolController {
    /** Materializes every declared tool, bound to the calling team/user scope. */
    buildTools(scope: AIToolScope): ToolSet {
        const tools: ToolSet = {};

        for (const definition of getAITools(this.constructor)) {
            tools[definition.name] = this.#buildTool(definition, scope);
        }

        return tools;
    }

    #buildTool(definition: AIToolDefinition, scope: AIToolScope): Tool {
        const toolDefinition: Record<string, unknown> = {
            description: definition.description,
            inputSchema: this.#buildSchema(definition)
        };

        if (!definition.clientExecuted) {
            toolDefinition.execute = this.#bindHandler(definition, scope);
        }

        // The AI SDK distinguishes an absent key from an explicit `false`, so the
        // gate is only attached when the tool actually declares one.
        if (definition.needsApproval !== undefined) {
            toolDefinition.needsApproval = definition.needsApproval;
        }

        return tool(toolDefinition as unknown as Tool);
    }

    #buildSchema(definition: AIToolDefinition) {
        const validate = (value: unknown): ValidationResult => {
            const result = definition.validate(value);

            return result.success
                ? {
                    success: true,
                    value: result.data
                }
                : {
                    success: false,
                    error: new Error(messageOf(result.errors))
                };
        };

        return jsonSchema(definition.parameters as Parameters<typeof jsonSchema>[0], { validate });
    }

    #bindHandler(definition: AIToolDefinition, scope: AIToolScope): (params: unknown) => Promise<unknown> {
        const handler = (this as unknown as Record<string | symbol, ToolHandler | undefined>)[definition.handlerName];

        if (!handler) {
            throw new Error(`AI tool "${definition.name}" has no handler method on ${this.constructor.name}.`);
        }

        // Scope is spread last so a model can never override teamId/userId by
        // declaring them as tool inputs.
        return async (params: unknown) => handler.call(this, {
            ...(params as Record<string, unknown>),
            ...scope
        });
    }
}
