import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import GetSimulationCellByTrajectoryUseCase from '@modules/simulation-cell/application/use-cases/GetSimulationCellByTrajectoryUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class GetSimulationCellAITool extends AITool {
    readonly name = 'get_simulation_cell';
    readonly description = 'Get the simulation cell for a trajectory.';
    readonly parameters = z.object({ trajectoryId: z.string(), timestep: z.number().optional() });

    constructor(
        protected readonly useCase: GetSimulationCellByTrajectoryUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            trajectoryId: params.trajectoryId,
            timestep: params.timestep
        });
        if (!result.success) throw result.error;
        return {
            summary: result.value
                ? `Found simulation cell for trajectory ${params.trajectoryId}.`
                : `No simulation cell found for trajectory ${params.trajectoryId}.`,
            data: result.value
        };
    }
}
