import { getAITools } from '@shared/ai/tool';
import type { AIToolDefinition } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';

export type AIToolHandler = (input: Record<string, unknown>, scope: AIToolScope) => Promise<unknown>;

export interface AIToolBinding {
    definition: AIToolDefinition;
    handler: AIToolHandler;
}

type ControllerMethod = (input: Record<string, unknown>) => unknown;

export default abstract class AIToolController {
    bindings(): AIToolBinding[] {
        return getAITools(this.constructor).map((definition) => ({
            definition,
            handler: this.#handlerOf(definition)
        }));
    }

    #handlerOf(definition: AIToolDefinition): AIToolHandler {
        const method = (this as unknown as Record<string | symbol, ControllerMethod | undefined>)[definition.handlerName];

        if (!method) {
            throw new Error(`AI tool "${definition.name}" has no handler method on ${this.constructor.name}.`);
        }

        return async (input, scope) => method.call(this, {
            ...input,
            ...scope
        });
    }
}
