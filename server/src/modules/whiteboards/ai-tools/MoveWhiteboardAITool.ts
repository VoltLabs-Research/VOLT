import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { MoveWhiteboardUseCase } from '@modules/whiteboards/use-cases/MoveWhiteboardUseCase';
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

    constructor(
        protected readonly useCase: MoveWhiteboardUseCase
    ) {
        super();
    }
}
