import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import DeleteTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/DeleteTrajectoryByIdUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
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
