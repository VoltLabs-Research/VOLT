import type { IAIToolService } from '@modules/ai/domain/port/IAIToolService';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { Singleton } from '@shared/infrastructure/di/decorators';
import type { ToolSet } from 'ai';
import { injectAll } from 'tsyringe';

@Singleton(AI_TOKENS.AIToolService)
export default class AIToolService implements IAIToolService {
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
