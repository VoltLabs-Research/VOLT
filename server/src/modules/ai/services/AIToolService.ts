import logger from '@shared/infrastructure/logger';
import type AIToolController from '@shared/ai/AIToolController';
import type { ToolSet } from 'ai';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';

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

        if (controllers.length === 0) {
            logger.warn('@ai: no AI tool controllers registered; call registerAIToolControllers() at boot');
        }

        for (const controller of controllers) {
            for (const [name, definition] of Object.entries(controller.buildTools(scope))) {
                if (name in tools) {
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
