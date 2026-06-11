import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import DeleteTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/DeleteTrajectoryByIdUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class DeleteTrajectoryAITool extends AITool {
    readonly name = 'delete_trajectory';
    readonly description = 'Delete a trajectory and its analyses.';
    readonly parameters = z.object({ trajectoryId: z.string(), reason: z.string().optional() });

    constructor(
        protected readonly useCase: DeleteTrajectoryByIdUseCase
    ) {
        super();
    }
}
