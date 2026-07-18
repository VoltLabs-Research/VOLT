import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import TrajectoryService from '@modules/trajectory/services/TrajectoryService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class GetTrajectoryAITool extends AITool {
    readonly name = 'get_trajectory';
    readonly description = 'Get detailed information about a specific trajectory.';
    readonly parameters = z.object({ trajectoryId: z.string() });

    #service = new TrajectoryService();

    async execute(params: z.infer<typeof this.parameters>, _scope: AIToolScope) {
        const value = await this.#service.getById({ trajectoryId: params.trajectoryId });
        return { summary: `Trajectory "${value.name}" (${value.status}).`, data: value };
    }
}
