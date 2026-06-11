import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { MoveWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/MoveWhiteboardUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
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
