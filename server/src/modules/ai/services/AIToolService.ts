import logger from '@shared/infrastructure/logger';
import type AIToolController from '@shared/ai/AIToolController';
import type { ToolSet } from 'ai';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';

/*
 * The controller set is *injected* rather than imported.
 *
 * Importing it here would close a cycle — this service would reach the barrel,
 * the barrel reaches `AiAIToolController`, and that reaches `AiService`, which
 * comes back here through `AISDKChatTransport`. Direction matters more than
 * location: the composition root may know about every module, but a module must
 * not know about the composition root.
 *
 * So the list stays a plain named array that `tsc` can see, and the entrypoint
 * hands it over once at boot.
 */
type AIToolControllerConstructor = new () => AIToolController;

let controllers: AIToolController[] = [];

export const registerAIToolControllers = (
    provided: readonly AIToolControllerConstructor[]
): void => {
    controllers = provided.map((Controller) => new Controller());
};

class AIToolService {
    createToolsForContext(teamId: string, userId: string): ToolSet {
        const scope: AIToolScope = {
            teamId,
            userId
        };
        const tools: ToolSet = {};

        /*
         * The decorator this replaced registered itself, so the set could never be
         * empty. An injected list can be, if an entrypoint forgets to hand it over
         * — and the symptom would be a model that has simply lost every tool,
         * which is hard to attribute. Say so instead.
         */
        if (controllers.length === 0) {
            logger.warn('@ai: no AI tool controllers registered; call registerAIToolControllers() at boot');
        }

        for (const controller of controllers) {
            for (const [name, definition] of Object.entries(controller.buildTools(scope))) {
                if (name in tools) {
                    // Two modules claiming the same tool name would silently
                    // shadow each other and hand the model the wrong behaviour.
                    logger.warn(
                        {
 tool: name, controller: controller.constructor.name 
},
                        '@ai: duplicate AI tool name; keeping the first registration'
                    );
                    continue;
                }

                tools[name] = definition;
            }
        }

        return tools;
    }
}

export default new AIToolService();
