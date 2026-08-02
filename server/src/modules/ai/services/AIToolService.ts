import logger from '@shared/infrastructure/logger';
import { getRegisteredAIToolProviders } from '@shared/ai/provider-registry';
import type { ToolSet } from 'ai';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';

class AIToolService {
    createToolsForContext(teamId: string, userId: string): ToolSet {
        const scope: AIToolScope = {
            teamId,
            userId
        };
        const tools: ToolSet = {};

        for (const controller of getRegisteredAIToolProviders()) {
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
