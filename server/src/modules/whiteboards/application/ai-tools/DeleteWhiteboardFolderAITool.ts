import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { DeleteWhiteboardFolderUseCase } from '@modules/whiteboards/application/use-cases/DeleteWhiteboardFolderUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class DeleteWhiteboardFolderAITool extends AITool {
    readonly name = 'delete_whiteboard_folder';
    readonly description = 'Delete a whiteboard folder.';
    readonly parameters = z.object({ folderId: z.string() });

    constructor(
        protected readonly useCase: DeleteWhiteboardFolderUseCase
    ) {
        super();
    }
}
