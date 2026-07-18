import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import WhiteboardService from '@modules/whiteboards/services/WhiteboardService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class DeleteWhiteboardAITool extends AITool {
    readonly name = 'delete_whiteboard';
    readonly description = 'Delete a whiteboard.';
    readonly parameters = z.object({ whiteboardId: z.string() });

    #service = new WhiteboardService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        await this.#service.deleteWhiteboard(scope.teamId, params.whiteboardId, scope.userId);
        return { summary: `Deleted whiteboard ${params.whiteboardId}.`, data: null };
    }
}
