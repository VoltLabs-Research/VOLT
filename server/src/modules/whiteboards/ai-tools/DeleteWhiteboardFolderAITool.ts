import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import WhiteboardService from '@modules/whiteboards/services/WhiteboardService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class DeleteWhiteboardFolderAITool extends AITool {
    readonly name = 'delete_whiteboard_folder';
    readonly description = 'Delete a whiteboard folder.';
    readonly parameters = z.object({ folderId: z.string() });

    #service = new WhiteboardService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        await this.#service.deleteFolder(scope.teamId, params.folderId, scope.userId);
        return { summary: `Deleted whiteboard folder ${params.folderId}.`, data: null };
    }
}
