import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import GetTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoryByIdUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class GetTrajectoryAITool extends AITool {
    readonly name = 'get_trajectory';
    readonly description = 'Get detailed information about a specific trajectory.';
    readonly parameters = z.object({ trajectoryId: z.string() });

    constructor(
        protected readonly useCase: GetTrajectoryByIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, _scope: AIToolScope) {
        const result = await this.useCase.execute({ trajectoryId: params.trajectoryId });
        if (!result.success) throw result.error;
        return { summary: `Trajectory "${result.value.name}" (${result.value.status}).`, data: result.value };
    }
}
