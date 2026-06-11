import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import DeleteTrajectoryFolderUseCase from '@modules/trajectory/application/use-cases/trajectory/DeleteTrajectoryFolderUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
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
