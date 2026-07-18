import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import WhiteboardService from '@modules/whiteboards/services/WhiteboardService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class MoveWhiteboardAITool extends AITool {
    readonly name = 'move_whiteboard';
    readonly description = 'Move a whiteboard to a different folder.';
    readonly parameters = z.object({
        whiteboardId: z.string(),
        folderId: z.string().nullable()
    });

    #service = new WhiteboardService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        await this.#service.moveWhiteboard(scope.teamId, params.whiteboardId, params.folderId);
        return { summary: `Moved whiteboard ${params.whiteboardId}.`, data: null };
    }
}
