import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import GetSimulationCellByTrajectoryUseCase from '@modules/simulation-cell/use-cases/GetSimulationCellByTrajectoryUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
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
        const value = await this.useCase.execute({
            teamId: scope.teamId,
            trajectoryId: params.trajectoryId,
            timestep: params.timestep
        });
        return {
            summary: value
                ? `Found simulation cell for trajectory ${params.trajectoryId}.`
                : `No simulation cell found for trajectory ${params.trajectoryId}.`,
            data: value
        };
    }
}
