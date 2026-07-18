import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import WhiteboardService from '@modules/whiteboards/services/WhiteboardService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class CreateWhiteboardAITool extends AITool {
    readonly name = 'create_whiteboard';
    readonly description = 'Create a new whiteboard.';
    readonly parameters = z.object({
        title: z.string(),
        folderId: z.string().nullable().optional()
    });

    #service = new WhiteboardService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.createWhiteboard(scope.teamId, scope.userId, {
            title: params.title,
            folderId: params.folderId
        });
    }
}
