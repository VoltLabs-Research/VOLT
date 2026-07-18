import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import UpdateTrajectoryByIdUseCase from '@modules/trajectory/use-cases/trajectory/UpdateTrajectoryByIdUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class UpdateTrajectoryAITool extends AITool {
    readonly name = 'update_trajectory';
    readonly description = 'Rename a trajectory or change its public visibility.';
    readonly parameters = z.object({
        trajectoryId: z.string(),
        name: z.string(),
        isPublic: z.boolean()
    });

    constructor(
        protected readonly useCase: UpdateTrajectoryByIdUseCase
    ) {
        super();
    }
}
