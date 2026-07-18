import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import WhiteboardService from '@modules/whiteboards/services/WhiteboardService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class UpdateWhiteboardAITool extends AITool {
    readonly name = 'update_whiteboard';
    readonly description = 'Update a whiteboard.';
    readonly parameters = z.object({
        whiteboardId: z.string(),
        title: z.string().optional()
    });

    #service = new WhiteboardService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.updateWhiteboard(scope.teamId, params.whiteboardId, scope.userId, {
            title: params.title
        });
    }
}
