import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import CloneTrajectoryUseCase from '@modules/trajectory/application/use-cases/trajectory/CloneTrajectoryUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class CloneTrajectoryAITool extends AITool {
    readonly name = 'clone_trajectory';
    readonly description = 'Clone an existing trajectory, optionally onto a target cluster.';
    readonly parameters = z.object({
        sourceTrajectoryId: z.string(),
        targetClusterId: z.string().optional()
    });

    constructor(
        protected readonly useCase: CloneTrajectoryUseCase
    ) {
        super();
    }
}
