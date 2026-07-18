import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import MoveTrajectoryUseCase from '@modules/trajectory/use-cases/trajectory/MoveTrajectoryUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class MoveTrajectoryAITool extends AITool {
    readonly name = 'move_trajectory';
    readonly description = 'Move a trajectory into a folder, or to the root when folderId is null.';
    readonly parameters = z.object({
        trajectoryId: z.string(),
        folderId: z.string().nullable()
    });

    constructor(
        protected readonly useCase: MoveTrajectoryUseCase
    ) {
        super();
    }
}
