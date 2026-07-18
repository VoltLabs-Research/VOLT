import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import SimulationCellService from '@modules/simulation-cell/services/SimulationCellService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class GetSimulationCellAITool extends AITool {
    readonly name = 'get_simulation_cell';
    readonly description = 'Get the simulation cell for a trajectory.';
    readonly parameters = z.object({ trajectoryId: z.string(), timestep: z.number().optional() });

    #service = new SimulationCellService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const value = await this.#service.getByTrajectory({
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
