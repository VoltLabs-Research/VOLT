import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import DeleteTrajectoryFolderUseCase from '@modules/trajectory/use-cases/trajectory/DeleteTrajectoryFolderUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class DeleteTrajectoryFolderAITool extends AITool {
    readonly name = 'delete_trajectory_folder';
    readonly description = 'Delete a trajectory folder and all trajectories within it.';
    readonly parameters = z.object({ folderId: z.string(), reason: z.string().optional() });

    constructor(
        protected readonly useCase: DeleteTrajectoryFolderUseCase
    ) {
        super();
    }
}
