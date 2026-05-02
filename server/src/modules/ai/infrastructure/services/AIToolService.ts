import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AITool } from '@shared/application/ai/AITool';
import { Singleton } from '@shared/infrastructure/di/decorators';
import type { ToolSet } from 'ai';
import { injectAll } from 'tsyringe';

export interface AIToolScope {
    teamId: string;
    userId: string;
}

@Singleton()
export default class AIToolService {
    constructor(
        @injectAll(AI_TOKENS.AITool)
        private readonly aiTools: AITool[] = []
    ) {}

    createToolsForContext(teamId: string, userId: string): ToolSet {
        const scope: AIToolScope = { teamId, userId };
        const allTools: ToolSet = {};
        for (const tool of this.aiTools) {
            Object.assign(allTools, tool.build(scope));
        }
        return allTools;
    }
}
