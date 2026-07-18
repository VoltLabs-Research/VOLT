import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import WhiteboardService from '@modules/whiteboards/services/WhiteboardService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class GetWhiteboardAITool extends AITool {
    readonly name = 'get_whiteboard';
    readonly description = 'Get detailed information about a specific whiteboard.';
    readonly parameters = z.object({ whiteboardId: z.string() });

    #service = new WhiteboardService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const value = await this.#service.getWhiteboard(scope.teamId, params.whiteboardId);
        return { summary: `Retrieved whiteboard ${params.whiteboardId}.`, data: value };
    }
}
