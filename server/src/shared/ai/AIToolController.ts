import { tool } from 'ai';
import type { Tool, ToolSet } from 'ai';
import { getAITools } from '@shared/ai/tool';
import type { AIToolDefinition } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';

type ToolHandler = (input: Record<string, unknown>) => unknown;

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
            inputSchema: definition.parameters
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

    #bindHandler(definition: AIToolDefinition, scope: AIToolScope): (params: unknown) => Promise<unknown> {
        const handler = (this as unknown as Record<string | symbol, ToolHandler | undefined>)[definition.handlerName];

        if (typeof handler !== 'function') {
            throw new Error(`AI tool "${definition.name}" has no handler method on ${this.constructor.name}.`);
        }

        // Scope is spread last so a model can never override teamId/userId by
        // declaring them as tool inputs.
        return async (params: unknown) => handler.call(this, { ...(params as Record<string, unknown>), ...scope });
    }
}
